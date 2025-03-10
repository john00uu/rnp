document.addEventListener("DOMContentLoaded", () => {
  // Configuration
  const config = {
    api: {
      baseUrl: "http://127.0.0.1:8000",
      endpoints: {
        columns: "/columns",
        sites: "/sites"
      }
    },
    pagination: {
      initialLimit: 50,
      loadMoreIncrement: 30,
      virtualScrollThreshold: 20
    },
    debounce: {
      search: 300,
      scroll: 100,
      resize: 200
    },
    autoRefresh: {
      enabled: false,
      interval: 60000 // 1 minute
    },
    columnWidth: {
      min: 80,
      max: 300,
      default: 150
    }
  };

  // State variables
  let state = {
    data: [],
    visibleData: [],
    filteredData: [],
    allColumns: [],
    selectedColumns: [],
    loading: false,
    pagination: {
      limit: config.pagination.initialLimit,
      offset: 0,
      hasMore: true
    },
    search: {
      dataQuery: "",
      columnQuery: ""
    },
    columnGroups: {},
    autoRefreshTimer: null,
    resizeObserver: null,
    activeRowIndex: -1,
    savedColumnWidths: {},
    isDragging: false,
    dragStartX: 0,
    dragColumnEl: null,
    dragColumnWidth: 0
  };

  // Default columns to display
  const defaultColumns = ["SITE_ID", "SITE NAME", "CITY/ROAD", "LAT", "LONG", "PLANNING STATUS"];
  
  // Fixed columns that should always appear first
  const fixedColumns = ["SITE_ID", "SITE NAME"];

  // DOM Elements
  const dom = {
    // Main containers
    logoContainer: document.getElementById("logo-container"),
    contentDiv: document.getElementById("content"),
    tableContainer: document.querySelector(".table-container"),
    loadingIndicator: document.getElementById("loading-indicator"),
    pageLoading: document.getElementById("page-loading"),
    
    // Table elements
    tableHead: document.getElementById("table-head"),
    tableBody: document.getElementById("table-body"),
    
    // Column selector
    selectorHeader: document.getElementById("selector-header"),
    selectorContent: document.getElementById("selector-content"),
    toggleSelector: document.getElementById("toggle-selector"),
    columnSelector: document.getElementById("column-selector"),
    columnGroupsContainer: document.getElementById("column-groups-container"),
    columnSearch: document.getElementById("column-search"),
    selectAllBtn: document.getElementById("select-all-columns"),
    deselectAllBtn: document.getElementById("deselect-all-columns"),
    resetDefaultBtn: document.getElementById("reset-default-columns"),
    selectedCount: document.getElementById("selected-count"),
    totalCount: document.getElementById("total-count"),
    
    // Data search
    dataSearch: document.getElementById("data-search"),
    
    // Counters
    visibleRows: document.getElementById("visible-rows"),
    totalRows: document.getElementById("total-rows"),
    
    // Navigation
    navLeft: document.getElementById("nav-left"),
    navRight: document.getElementById("nav-right"),
    navUp: document.getElementById("nav-up"),
    navDown: document.getElementById("nav-down"),
    loadMoreBtn: document.getElementById("load-more"),
    
    // Modal
    modalBody: document.getElementById("modal-body"),
    
    // Controls
    refreshBtn: document.getElementById("refresh-data"),
    autoRefreshToggle: document.getElementById("auto-refresh-toggle"),
    
    // Toast
    toastContainer: document.getElementById("toast-container")
  };

  // Debug logging function with toggle
  const DEBUG = true;
  function logDebug(message, data) {
    if (DEBUG) {
      console.log(`[Debug] ${message}`, data);
    }
  }

  // ===== UTILITY FUNCTIONS =====

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Function to safely access nested properties
  function safeGet(obj, path, defaultValue = "N/A") {
    if (!obj) return defaultValue;

    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== "object") {
        return defaultValue;
      }
      current = current[key];
    }

    return current !== null && current !== undefined ? current : defaultValue;
  }

  // Show toast notification
  function showToast(message, type = "info", duration = 3000) {
    if (!dom.toastContainer) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    dom.toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ===== UI STATE MANAGEMENT =====

  function showLoading() {
    if (dom.loadingIndicator) {
      dom.loadingIndicator.classList.add("show");
    }
  }

  function hideLoading() {
    if (dom.loadingIndicator) {
      dom.loadingIndicator.classList.remove("show");
    }
  }

  function showPageLoading() {
    if (dom.pageLoading) {
      dom.pageLoading.classList.add("show");
    }
  }

  function hidePageLoading() {
    if (dom.pageLoading) {
      dom.pageLoading.classList.remove("show");
    }
  }

  function showContent() {
    if (dom.logoContainer) {
      dom.logoContainer.style.display = "none";
    }
    if (dom.contentDiv) {
      dom.contentDiv.style.display = "block";
    }
    updateScrollIndicators();
  }

  // Toggle column selector
  function toggleColumnSelector() {
    if (dom.selectorContent.style.display === "none") {
      dom.selectorContent.style.display = "block";
      dom.toggleSelector.classList.add("open");
      dom.toggleSelector.setAttribute("aria-expanded", "true");
    } else {
      dom.selectorContent.style.display = "none";
      dom.toggleSelector.classList.remove("open");
      dom.toggleSelector.setAttribute("aria-expanded", "false");
    }
  }

  // Update column counts
  function updateColumnCounts() {
    if (dom.selectedCount && dom.totalCount) {
      dom.selectedCount.textContent = state.selectedColumns.length.toString();
      dom.totalCount.textContent = state.allColumns.length.toString();
    }
  }

  // Update visible and total row counts
  function updateRowCounts() {
    if (dom.visibleRows && dom.totalRows) {
      dom.visibleRows.textContent = state.visibleData.length.toString();
      dom.totalRows.textContent = state.filteredData.length.toString();
    }
  }

  // Update navigation button states
  function updateScrollIndicators() {
    if (!dom.tableContainer) return;

    const scrollWidth = dom.tableContainer.scrollWidth;
    const clientWidth = dom.tableContainer.clientWidth;
    const scrollHeight = dom.tableContainer.scrollHeight;
    const clientHeight = dom.tableContainer.clientHeight;
    const scrollLeft = dom.tableContainer.scrollLeft;
    const scrollTop = dom.tableContainer.scrollTop;

    // Has horizontal scroll?
    const hasHorizontalScroll = scrollWidth > clientWidth;
    const maxHorizontalScroll = scrollWidth - clientWidth;

    // Has vertical scroll?
    const hasVerticalScroll = scrollHeight > clientHeight;
    const maxVerticalScroll = scrollHeight - clientHeight;

    // Update nav buttons
    if (dom.navLeft) {
      dom.navLeft.disabled = !hasHorizontalScroll || scrollLeft <= 0;
      dom.navLeft.classList.toggle("disabled", !hasHorizontalScroll || scrollLeft <= 0);
    }

    if (dom.navRight) {
      dom.navRight.disabled = !hasHorizontalScroll || scrollLeft >= maxHorizontalScroll - 5;
      dom.navRight.classList.toggle("disabled", !hasHorizontalScroll || scrollLeft >= maxHorizontalScroll - 5);
    }

    if (dom.navUp) {
      dom.navUp.disabled = !hasVerticalScroll || scrollTop <= 0;
      dom.navUp.classList.toggle("disabled", !hasVerticalScroll || scrollTop <= 0);
    }

    if (dom.navDown) {
      dom.navDown.disabled = !hasVerticalScroll || scrollTop >= maxVerticalScroll - 5;
      dom.navDown.classList.toggle("disabled", !hasVerticalScroll || scrollTop >= maxVerticalScroll - 5);
    }
  }

  // ===== DATA HANDLING =====

  function filterData() {
    if (!state.data.length) return [];
    
    const query = state.search.dataQuery.toLowerCase().trim();
    
    if (!query) {
      state.filteredData = [...state.data];
      return state.filteredData;
    }
    
    state.filteredData = state.data.filter(row => {
      if (!row || typeof row !== "object") return false;
      
      // Search in all fields
      for (const key in row) {
        const value = String(row[key] || "").toLowerCase();
        if (value.includes(query)) {
          return true;
        }
      }
      return false;
    });
    
    return state.filteredData;
  }

  function paginateData() {
    if (!state.filteredData.length) return [];
    
    state.visibleData = state.filteredData.slice(0, state.pagination.limit);
    return state.visibleData;
  }

  // Create dummy data for testing
  function createDummyData(count) {
    const dummyData = [];
    const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego"];
    const statuses = ["Planning", "Construction", "Operational", "Maintenance", "Decommissioned", "Proposed"];
    const types = ["Tower", "Rooftop", "Monopole", "Guyed Tower", "Stealth Site", "Small Cell"];

    for (let i = 0; i < count; i++) {
      const site_id = `SVN${(7000 + i).toString().padStart(4, "0")}`;
      const city = cities[Math.floor(Math.random() * cities.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      
      // Create random coordinates
      const lat = (Math.random() * (42.5 - 32.5) + 32.5).toFixed(6);
      const long = (Math.random() * (-75.5 + 118.5) - 118.5).toFixed(6);
      
      // Create random dates
      const today = new Date();
      const activationDate = new Date(today);
      activationDate.setDate(today.getDate() - Math.floor(Math.random() * 1000));
      
      const lastUpdate = new Date(today);
      lastUpdate.setDate(today.getDate() - Math.floor(Math.random() * 30));
      
      dummyData.push({
        "SITE_ID": site_id,
        "SITE NAME": `${city} ${type} ${i + 1}`,
        "CITY/ROAD": city,
        "LAT": lat,
        "LONG": long,
        "PLANNING STATUS": status,
        "SITE TYPE": type,
        "ACTIVATION DATE": activationDate.toISOString().split('T')[0],
        "LAST UPDATE": lastUpdate.toISOString().split('T')[0],
        "HEIGHT": Math.floor(Math.random() * 100) + 20,
        "POWER": Math.floor(Math.random() * 50) + 10,
        "BANDWIDTH": Math.floor(Math.random() * 100) + 50,
        "COVERAGE_RADIUS": Math.floor(Math.random() * 10) + 1,
        "MAINTENANCE_CYCLE": Math.floor(Math.random() * 12) + 1,
        "VENDOR": ["Nokia", "Ericsson", "Huawei", "Samsung", "ZTE"][Math.floor(Math.random() * 5)],
        "COMMENTS": `Site ${site_id} is currently in ${status.toLowerCase()} phase.`
      });
    }
    
    return dummyData;
  }

  // ===== API CALLS =====

  async function fetchData(useCache = true) {
    try {
      showLoading();
      state.loading = true;
      
      // For demo purpose, use dummy data instead of actual API call
      if (DEBUG) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        state.data = createDummyData(500);
        filterData();
        paginateData();
        
        // Extract all possible columns from the first record
        if (state.data.length > 0) {
          state.allColumns = Object.keys(state.data[0]);
          
          // Group columns for better organization
          state.columnGroups = {
            "Location": ["SITE_ID", "SITE NAME", "CITY/ROAD", "LAT", "LONG"],
            "Technical": ["SITE TYPE", "HEIGHT", "POWER", "BANDWIDTH", "COVERAGE_RADIUS", "VENDOR"],
            "Status": ["PLANNING STATUS", "ACTIVATION DATE", "LAST UPDATE", "MAINTENANCE_CYCLE"],
            "Other": ["COMMENTS"]
          };
          
          // If no columns are selected yet, use default columns
          if (!state.selectedColumns.length) {
            state.selectedColumns = [...defaultColumns];
          }
        }
        
        updateTable();
        hideLoading();
        state.loading = false;
        return state.data;
      }
      
      // Actual API call would be something like:
      // const response = await fetch(`${config.api.baseUrl}${config.api.endpoints.sites}`);
      // if (!response.ok) throw new Error('Failed to fetch data');
      // state.data = await response.json();
      
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("Failed to fetch data. Please try again.", "error");
      hideLoading();
      state.loading = false;
      return [];
    }
  }

  async function fetchColumns() {
    try {
      // For demo purpose, we'll just use the columns from the dummy data
      // In a real application, you might fetch column definitions from an API
      
      if (DEBUG) {
        if (state.data.length > 0) {
          state.allColumns = Object.keys(state.data[0]);
          return state.allColumns;
        }
      }
      
      // Actual API call would be something like:
      // const response = await fetch(`${config.api.baseUrl}${config.api.endpoints.columns}`);
      // if (!response.ok) throw new Error('Failed to fetch columns');
      // state.allColumns = await response.json();
      // return state.allColumns;
      
    } catch (error) {
      console.error("Error fetching columns:", error);
      showToast("Failed to fetch column definitions.", "error");
      return [];
    }
  }

  // ===== TABLE HANDLING =====

  function createTableHeader() {
    if (!dom.tableHead) return;
    
    dom.tableHead.innerHTML = "";
    const headerRow = document.createElement("tr");
    
    state.selectedColumns.forEach(column => {
      const th = document.createElement("th");
      th.textContent = column;
      th.dataset.column = column;
      
      // Set width from saved settings or use default
      const savedWidth = state.savedColumnWidths[column];
      if (savedWidth) {
        th.style.width = `${savedWidth}px`;
      } else {
        th.style.width = `${config.columnWidth.default}px`;
      }
      
      // Add resize handle
      const resizeHandle = document.createElement("span");
      resizeHandle.className = "resize-handle";
      th.appendChild(resizeHandle);
      
      // Add event listeners for column resizing
      resizeHandle.addEventListener("mousedown", (e) => {
        state.isDragging = true;
        state.dragColumnEl = th;
        state.dragStartX = e.clientX;
        state.dragColumnWidth = parseInt(th.offsetWidth, 10);
        
        document.body.classList.add("resizing");
        e.preventDefault();
      });
      
      headerRow.appendChild(th);
    });
    
    dom.tableHead.appendChild(headerRow);
  }

  function createTableBody() {
    if (!dom.tableBody) return;
    
    dom.tableBody.innerHTML = "";
    
    if (!state.visibleData.length) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.textContent = "No data available";
      emptyCell.colSpan = state.selectedColumns.length || 1;
      emptyCell.className = "empty-table";
      emptyRow.appendChild(emptyCell);
      dom.tableBody.appendChild(emptyRow);
      return;
    }
    
    state.visibleData.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = index.toString();
      
      // Make row active if it's the active row
      if (index === state.activeRowIndex) {
        tr.classList.add("active");
      }
      
      // Add click event to make row active
      tr.addEventListener("click", () => {
        state.activeRowIndex = index;
        updateTable();
      });
      
      state.selectedColumns.forEach(column => {
        const td = document.createElement("td");
        td.textContent = safeGet(row, column);
        tr.appendChild(td);
      });
      
      dom.tableBody.appendChild(tr);
    });
  }

  function updateTable() {
    createTableHeader();
    createTableBody();
    updateRowCounts();
  }

  // ===== COLUMN SELECTION UI =====

  function createColumnSelector() {
    if (!dom.columnSelector) return;
    
    dom.columnSelector.innerHTML = "";
    
    // Create groups if they exist
    if (Object.keys(state.columnGroups).length) {
      for (const [groupName, columns] of Object.entries(state.columnGroups)) {
        const groupDiv = document.createElement("div");
        groupDiv.className = "column-group";
        
        const groupHeader = document.createElement("div");
        groupHeader.className = "group-header";
        groupHeader.textContent = groupName;
        groupDiv.appendChild(groupHeader);
        
        columns.forEach(column => {
          if (state.allColumns.includes(column)) {
            const columnDiv = createColumnCheckbox(column);
            groupDiv.appendChild(columnDiv);
          }
        });
        
        dom.columnSelector.appendChild(groupDiv);
      }
    } else {
      // If no groups, just list all columns
      state.allColumns.forEach(column => {
        const columnDiv = createColumnCheckbox(column);
        dom.columnSelector.appendChild(columnDiv);
      });
    }
    
    updateColumnCounts();
  }

  function createColumnCheckbox(column) {
    const columnDiv = document.createElement("div");
    columnDiv.className = "column-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `col-${column}`;
    checkbox.checked = state.selectedColumns.includes(column);
    checkbox.disabled = fixedColumns.includes(column); // Disable fixed columns
    
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        // Add column if not already in the list
        if (!state.selectedColumns.includes(column)) {
          state.selectedColumns.push(column);
        }
      } else {
        // Remove column if it's not a fixed column
        if (!fixedColumns.includes(column)) {
          state.selectedColumns = state.selectedColumns.filter(col => col !== column);
        }
      }
      
      updateTable();
      updateColumnCounts();
      saveColumnSelection();
    });
    
    const label = document.createElement("label");
    label.setAttribute("for", `col-${column}`);
    label.textContent = column;
    
    columnDiv.appendChild(checkbox);
    columnDiv.appendChild(label);
    
    return columnDiv;
  }

  function filterColumns() {
    const query = state.search.columnQuery.toLowerCase().trim();
    
    const columnItems = dom.columnSelector.querySelectorAll(".column-item");
    const groupHeaders = dom.columnSelector.querySelectorAll(".group-header");
    
    // Reset visibility
    groupHeaders.forEach(header => {
      header.style.display = "block";
    });
    
    let visibleGroups = {};
    
    columnItems.forEach(item => {
      const label = item.querySelector("label");
      const columnName = label.textContent.toLowerCase();
      const groupHeader = item.closest(".column-group")?.querySelector(".group-header");
      const groupName = groupHeader ? groupHeader.textContent : "";
      
      if (!query || columnName.includes(query)) {
        item.style.display = "flex";
        if (groupName) {
          visibleGroups[groupName] = true;
        }
      } else {
        item.style.display = "none";
      }
    });
    
    // Hide group headers with no visible items
    groupHeaders.forEach(header => {
      const groupName = header.textContent;
      if (!visibleGroups[groupName]) {
        header.style.display = "none";
      }
    });
  }

  // ===== LOCAL STORAGE =====

  function saveColumnSelection() {
    try {
      localStorage.setItem("selectedColumns", JSON.stringify(state.selectedColumns));
    } catch (error) {
      console.error("Failed to save column selection:", error);
    }
  }

  function loadColumnSelection() {
    try {
      const saved = localStorage.getItem("selectedColumns");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure fixed columns are always included
        fixedColumns.forEach(col => {
          if (!parsed.includes(col)) {
            parsed.unshift(col);
          }
        });
        state.selectedColumns = parsed;
      } else {
        state.selectedColumns = [...defaultColumns];
      }
    } catch (error) {
      console.error("Failed to load column selection:", error);
      state.selectedColumns = [...defaultColumns];
    }
  }

  function saveColumnWidths() {
    try {
      localStorage.setItem("columnWidths", JSON.stringify(state.savedColumnWidths));
    } catch (error) {
      console.error("Failed to save column widths:", error);
    }
  }

  function loadColumnWidths() {
    try {
      const saved = localStorage.getItem("columnWidths");
      if (saved) {
        state.savedColumnWidths = JSON.parse(saved);
      }
    } catch (error) {
      console.error("Failed to load column widths:", error);
      state.savedColumnWidths = {};
    }
  }

  // ===== EVENT LISTENERS =====

  function setupEventListeners() {
    // Toggle column selector
    if (dom.toggleSelector) {
      dom.toggleSelector.addEventListener("click", toggleColumnSelector);
    }
    
    // Column selection actions
    if (dom.selectAllBtn) {
      dom.selectAllBtn.addEventListener("click", () => {
        state.selectedColumns = [...state.allColumns];
        createColumnSelector();
        updateTable();
        saveColumnSelection();
      });
    }
    
    if (dom.deselectAllBtn) {
      dom.deselectAllBtn.addEventListener("click", () => {
        state.selectedColumns = [...fixedColumns];
        createColumnSelector();
        updateTable();
        saveColumnSelection();
      });
    }
    
    if (dom.resetDefaultBtn) {
      dom.resetDefaultBtn.addEventListener("click", () => {
        state.selectedColumns = [...defaultColumns];
        createColumnSelector();
        updateTable();
        saveColumnSelection();
      });
    }
    
    // Search inputs
    if (dom.dataSearch) {
      dom.dataSearch.addEventListener("input", debounce(() => {
        state.search.dataQuery = dom.dataSearch.value;
        filterData();
        
        // Reset pagination when searching
        state.pagination.limit = config.pagination.initialLimit;
        state.pagination.offset = 0;
        
        paginateData();
        updateTable();
      }, config.debounce.search));
    }
    
    if (dom.columnSearch) {
      dom.columnSearch.addEventListener("input", debounce(() => {
        state.search.columnQuery = dom.columnSearch.value;
        filterColumns();
      }, config.debounce.search));
    }
    
    // Navigation buttons
    if (dom.navLeft) {
      dom.navLeft.addEventListener("click", () => {
        if (dom.tableContainer) {
          dom.tableContainer.scrollBy({ left: -200, behavior: "smooth" });
        }
      });
    }
    
    if (dom.navRight) {
      dom.navRight.addEventListener("click", () => {
        if (dom.tableContainer) {
          dom.tableContainer.scrollBy({ left: 200, behavior: "smooth" });
        }
      });
    }
    
    if (dom.navUp) {
      dom.navUp.addEventListener("click", () => {
        if (dom.tableContainer) {
          dom.tableContainer.scrollBy({ top: -200, behavior: "smooth" });
        }
      });
    }
    
    if (dom.navDown) {
      dom.navDown.addEventListener("click", () => {
        if (dom.tableContainer) {
          dom.tableContainer.scrollBy({ top: 200, behavior: "smooth" });
        }
      });
    }
    
    // Load more button
    if (dom.loadMoreBtn) {
      dom.loadMoreBtn.addEventListener("click", () => {
        state.pagination.limit += config.pagination.loadMoreIncrement;
        paginateData();
        updateTable();
      });
    }
    
    // Refresh button
    if (dom.refreshBtn) {
      dom.refreshBtn.addEventListener("click", () => {
        fetchData(false).then(() => {
          showToast("Data refreshed successfully", "success");
        });
      });
    }
    
    // Auto-refresh toggle
    if (dom.autoRefreshToggle) {
      dom.autoRefreshToggle.addEventListener("change", () => {
        config.autoRefresh.enabled = dom.autoRefreshToggle.checked;
        
        if (config.autoRefresh.enabled) {
          state.autoRefreshTimer = setInterval(() => {
            fetchData(false);
          }, config.autoRefresh.interval);
          
          showToast("Auto-refresh enabled", "info");
        } else {
          if (state.autoRefreshTimer) {
            clearInterval(state.autoRefreshTimer);
            state.autoRefreshTimer = null;
          }
          
          showToast("Auto-refresh disabled", "info");
        }
      });
    }
    
    // Table scroll
    if (dom.tableContainer) {
      dom.tableContainer.addEventListener("scroll", debounce(() => {
        updateScrollIndicators();
      }, config.debounce.scroll));
    }
    
    // Window resize
    window.addEventListener("resize", debounce(() => {
      updateScrollIndicators();
    }, config.debounce.resize));
    
    // Column resize handling
    document.addEventListener("mousemove", (e) => {
      if (state.isDragging && state.dragColumnEl) {
        const width = Math.max(
          config.columnWidth.min,
          Math.min(
            config.columnWidth.max,
            state.dragColumnWidth + (e.clientX - state.dragStartX)
          )
        );
        
        state.dragColumnEl.style.width = `${width}px`;
        
        // Save the width in state
        const columnName = state.dragColumnEl.dataset.column;
        if (columnName) {
          state.savedColumnWidths[columnName] = width;
        }
      }
    });
    
    document.addEventListener("mouseup", () => {
      if (state.isDragging) {
        state.isDragging = false;
        document.body.classList.remove("resizing");
        saveColumnWidths();
      }
    });
    
    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (state.activeRowIndex >= 0 && state.visibleData.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          state.activeRowIndex = Math.min(state.activeRowIndex + 1, state.visibleData.length - 1);
          updateTable();
          scrollToActiveRow();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          state.activeRowIndex = Math.max(state.activeRowIndex - 1, 0);
          updateTable();
          scrollToActiveRow();
        } else if (e.key === "Enter") {
          e.preventDefault();
          showRowDetails(state.visibleData[state.activeRowIndex]);
        }
      }
    });
  }

  function scrollToActiveRow() {
    const activeRow = dom.tableBody.querySelector("tr.active");
    if (activeRow) {
      activeRow.scrollIntoView({
        block: "nearest",
        behavior: "smooth"
      });
    }
  }

  // ===== MODALS =====

  function showRowDetails(rowData) {
    if (!dom.modalBody || !rowData) return;
    
    // Create modal content
    dom.modalBody.innerHTML = "";
    
    const table = document.createElement("table");
    table.className = "details-table";
    
    for (const [key, value] of Object.entries(rowData)) {
      const tr = document.createElement("tr");
      
      const th = document.createElement("th");
      th.textContent = key;
      
      const td = document.createElement("td");
      td.textContent = value;
      
      tr.appendChild(th);
      tr.appendChild(td);
      table.appendChild(tr);
    }
    
    dom.modalBody.appendChild(table);
    
    // Show modal
    const modal = document.getElementById("details-modal");
    if (modal) {
      modal.classList.add("open");
      
      // Add close button functionality if it exists
      const closeBtn = modal.querySelector(".close-modal");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          modal.classList.remove("open");
        });
      }
      
// Close when clicking outside
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove("open");
  }
});
}
}

// ===== INITIALIZATION =====

function initApp() {
// Show initial loading screen
showPageLoading();

// Load saved settings
loadColumnWidths();
loadColumnSelection();

// Set up event listeners
setupEventListeners();

// Hide column selector content initially
if (dom.selectorContent) {
dom.selectorContent.style.display = "none";
}

// Fetch data
fetchData().then(() => {
// Create column selector UI
createColumnSelector();

// Hide page loading and show content
hidePageLoading();
showContent();

// Initialize auto-refresh if enabled
if (config.autoRefresh.enabled && dom.autoRefreshToggle) {
  dom.autoRefreshToggle.checked = true;
  state.autoRefreshTimer = setInterval(() => {
    fetchData(false);
  }, config.autoRefresh.interval);
}

// Set up resize observer for table container
if (window.ResizeObserver && dom.tableContainer) {
  state.resizeObserver = new ResizeObserver(debounce(() => {
    updateScrollIndicators();
  }, config.debounce.resize));
  
  state.resizeObserver.observe(dom.tableContainer);
}
});
}

// Create virtual scrolling to handle large datasets more efficiently
function setupVirtualScroll() {
if (!dom.tableContainer || !dom.tableBody) return;

dom.tableContainer.addEventListener("scroll", debounce(() => {
const scrollTop = dom.tableContainer.scrollTop;
const clientHeight = dom.tableContainer.clientHeight;
const scrollHeight = dom.tableContainer.scrollHeight;

// If scrolled near the bottom and there's more data to load
if (scrollHeight - scrollTop - clientHeight < config.pagination.virtualScrollThreshold * 20 && 
    state.filteredData.length > state.visibleData.length) {
  
  // Load more rows
  state.pagination.limit += config.pagination.loadMoreIncrement;
  paginateData();
  updateTable();
}
}, config.debounce.scroll));
}

// Export functionality
function setupExport() {
const exportBtn = document.getElementById("export-data");
if (!exportBtn) return;

exportBtn.addEventListener("click", () => {
if (!state.visibleData.length) {
  showToast("No data to export", "error");
  return;
}

try {
  // Create CSV content
  let csvContent = "";
  
  // Add header row
  csvContent += state.selectedColumns.join(",") + "\n";
  
  // Add data rows
  state.visibleData.forEach(row => {
    const rowValues = state.selectedColumns.map(col => {
      // Escape commas and quotes
      let value = safeGet(row, col, "");
      if (typeof value === "string") {
        value = value.replace(/"/g, '""');
        if (value.includes(",") || value.includes("\n") || value.includes('"')) {
          value = `"${value}"`;
        }
      }
      return value;
    });
    
    csvContent += rowValues.join(",") + "\n";
  });
  
  // Create downloadable link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `site_data_export_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("Data exported successfully", "success");
} catch (error) {
  console.error("Export failed:", error);
  showToast("Export failed. Please try again.", "error");
}
});
}

// Error handling and recovery
function setupErrorHandling() {
window.addEventListener("error", (event) => {
console.error("Global error:", event.error);
showToast("An error occurred. Please refresh the page.", "error", 5000);

// Log to hypothetical error tracking service
if (window.errorTracker) {
  window.errorTracker.logError({
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    error: event.error
  });
}
});

// Add a recovery button to the page
const recoverBtn = document.getElementById("recover-app");
if (recoverBtn) {
recoverBtn.addEventListener("click", () => {
  try {
    // Clear any broken state
    clearInterval(state.autoRefreshTimer);
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
    }
    
    // Reset the application
    state = {
      data: [],
      visibleData: [],
      filteredData: [],
      allColumns: [],
      selectedColumns: [],
      loading: false,
      pagination: {
        limit: config.pagination.initialLimit,
        offset: 0,
        hasMore: true
      },
      search: {
        dataQuery: "",
        columnQuery: ""
      },
      columnGroups: {},
      autoRefreshTimer: null,
      resizeObserver: null,
      activeRowIndex: -1,
      savedColumnWidths: {},
      isDragging: false,
      dragStartX: 0,
      dragColumnEl: null,
      dragColumnWidth: 0
    };
    
    // Re-initialize
    initApp();
    showToast("Application has been reset", "success");
  } catch (error) {
    console.error("Recovery failed:", error);
    showToast("Recovery failed. Please refresh the page.", "error");
  }
});
}
}

// Mobile support
function setupMobileSupport() {
// Check if the device is mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
document.body.classList.add("mobile");

// Adjust column widths for mobile
config.columnWidth.default = 120;
config.columnWidth.min = 80;
config.columnWidth.max = 200;

// For touch devices, modify navigation
if (dom.tableContainer) {
  // Add touch support for horizontal scrolling
  let touchStartX = 0;
  let touchStartY = 0;
  
  dom.tableContainer.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });
  
  dom.tableContainer.addEventListener("touchmove", (e) => {
    if (!touchStartX || !touchStartY) return;
    
    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    
    // If horizontal movement is greater than vertical, prevent default to avoid page scrolling
    if (Math.abs(diffX) > Math.abs(diffY)) {
      e.preventDefault();
    }
    
    touchStartX = touchEndX;
    touchStartY = touchEndY;
  });
}

// Add a mobile menu toggle if it exists
const mobileMenuBtn = document.getElementById("mobile-menu-toggle");
const sideNav = document.getElementById("side-nav");

if (mobileMenuBtn && sideNav) {
  mobileMenuBtn.addEventListener("click", () => {
    sideNav.classList.toggle("open");
  });
  
  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (sideNav.classList.contains("open") && 
        !sideNav.contains(e.target) && 
        e.target !== mobileMenuBtn) {
      sideNav.classList.remove("open");
    }
  });
}
}
}

// Theme support
function setupThemeSupport() {
const themeToggle = document.getElementById("theme-toggle");
if (!themeToggle) return;

// Check for saved theme or system preference
const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
document.body.classList.add("dark-theme");
themeToggle.checked = true;
}

themeToggle.addEventListener("change", () => {
if (themeToggle.checked) {
  document.body.classList.add("dark-theme");
  localStorage.setItem("theme", "dark");
} else {
  document.body.classList.remove("dark-theme");
  localStorage.setItem("theme", "light");
}
});
}

// Performance optimization
function optimizeForPerformance() {
// Use requestAnimationFrame for table updates
let updateTableRAF;

function scheduleTableUpdate() {
if (updateTableRAF) {
  cancelAnimationFrame(updateTableRAF);
}

updateTableRAF = requestAnimationFrame(() => {
  updateTable();
  updateTableRAF = null;
});
}

// Override updateTable with the optimized version
const originalUpdateTable = updateTable;
updateTable = scheduleTableUpdate;

// Use Intersection Observer to only render visible rows
if ("IntersectionObserver" in window && dom.tableBody) {
const observerOptions = {
  root: dom.tableContainer,
  rootMargin: "200px 0px",
  threshold: 0
};

const rowObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const row = entry.target;
    
    if (entry.isIntersecting) {
      // Load row content if not already loaded
      if (row.dataset.loaded !== "true") {
        const index = parseInt(row.dataset.index, 10);
        const rowData = state.visibleData[index];
        
        if (rowData) {
          // Clear placeholder content
          row.innerHTML = "";
          
          // Add actual cells
          state.selectedColumns.forEach(column => {
            const td = document.createElement("td");
            td.textContent = safeGet(rowData, column);
            row.appendChild(td);
          });
          
          row.dataset.loaded = "true";
        }
      }
    } else {
      // Optionally unload row content to save memory
      // This would be useful for very large datasets
      if (row.dataset.loaded === "true" && state.visibleData.length > 1000) {
        // Replace with placeholder cells
        const cellCount = state.selectedColumns.length;
        row.innerHTML = "";
        
        for (let i = 0; i < cellCount; i++) {
          const td = document.createElement("td");
          td.innerHTML = "&nbsp;";
          row.appendChild(td);
        }
        
        row.dataset.loaded = "false";
      }
    }
  });
}, observerOptions);

// Modified createTableBody function for virtualization
const originalCreateTableBody = createTableBody;
createTableBody = function() {
  if (!dom.tableBody) return;
  
  dom.tableBody.innerHTML = "";
  
  if (!state.visibleData.length) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.textContent = "No data available";
    emptyCell.colSpan = state.selectedColumns.length || 1;
    emptyCell.className = "empty-table";
    emptyRow.appendChild(emptyCell);
    dom.tableBody.appendChild(emptyRow);
    return;
  }
  
  // For large datasets, create placeholder rows first
  if (state.visibleData.length > 200) {
    state.visibleData.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.dataset.index = index.toString();
      tr.dataset.loaded = "false";
      
      // Make row active if it's the active row
      if (index === state.activeRowIndex) {
        tr.classList.add("active");
      }
      
      // Add click event to make row active
      tr.addEventListener("click", () => {
        state.activeRowIndex = index;
        updateTable();
      });
      
      // Add placeholder cells
      for (let i = 0; i < state.selectedColumns.length; i++) {
        const td = document.createElement("td");
        td.innerHTML = "&nbsp;";
        tr.appendChild(td);
      }
      
      dom.tableBody.appendChild(tr);
      
      // Observe row for visibility
      rowObserver.observe(tr);
    });
  } else {
    // For smaller datasets, create all rows normally
    originalCreateTableBody();
  }
};
}
}

// Start the application
initApp();
setupVirtualScroll();
setupExport();
setupErrorHandling();
setupMobileSupport();
setupThemeSupport();

// Only enable performance optimizations if there's a large dataset
if (state.data.length > 500) {
optimizeForPerformance();
}
});