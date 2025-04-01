document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token) {
        // Redirect to login page if not logged in
        window.location.href = '/login-page';
        return;
    }
    
    // Set username in header
    document.getElementById('username').textContent = username || 'User';
    
    // Initialize variables
    let columns = [];
    let visibleColumns = [];
    let allData = [];
    let currentOffset = 0;
    const limit = 20;
    let isLoading = false;
    let isEditMode = false;
    let pendingChanges = [];
    
    // DOM elements
    const dataGrid = document.getElementById('dataGrid');
    const dataGridHeader = document.getElementById('dataGridHeader');
    const dataGridBody = document.getElementById('dataGridBody');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const noDataMessage = document.getElementById('noDataMessage');
    const columnList = document.getElementById('columnList');
    const columnDropdown = document.getElementById('columnDropdown');
    const columnSelectorBtn = document.getElementById('columnSelectorBtn');
    const searchColumns = document.getElementById('searchColumns');
    const advancedSearchPanel = document.getElementById('advancedSearchPanel');
    const advancedSearchBtn = document.getElementById('advancedSearchBtn');
    const closeAdvancedSearch = document.getElementById('closeAdvancedSearch');
    const applySearchBtn = document.getElementById('applySearchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const globalSearch = document.getElementById('globalSearch');
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    const editModeBtn = document.getElementById('editModeBtn');
    const importModal = document.getElementById('importModal');
    const rowDetailsModal = document.getElementById('rowDetailsModal');
    const themeToggle = document.getElementById('themeToggle');
    const logoutBtn = document.getElementById('logoutBtn');
    const saveColumnsBtn = document.getElementById('saveColumnsBtn');
    const resetColumnsBtn = document.getElementById('resetColumnsBtn');
    
    // Initialize theme
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    if (prefersDarkScheme.matches) {
        document.body.classList.add('dark-theme');
    }
    
    // Initialize map
    const map = L.map('networkMapContainer').setView([40.4093, 49.8671], 8); // Azerbaijan coordinates
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Event listeners
    themeToggle.addEventListener('click', toggleTheme);
    logoutBtn.addEventListener('click', logout);
    columnSelectorBtn.addEventListener('click', toggleColumnDropdown);
    advancedSearchBtn.addEventListener('click', toggleAdvancedSearch);
    closeAdvancedSearch.addEventListener('click', toggleAdvancedSearch);
    applySearchBtn.addEventListener('click', applyAdvancedSearch);
    clearSearchBtn.addEventListener('click', clearAdvancedSearch);
    globalSearch.addEventListener('input', debounce(handleGlobalSearch, 300));
    importBtn.addEventListener('click', openImportModal);
    exportBtn.addEventListener('click', exportData);
    editModeBtn.addEventListener('click', toggleEditMode);
    saveColumnsBtn.addEventListener('click', saveColumnsAsDefault);
    resetColumnsBtn.addEventListener('click', resetColumns);
    
    // Close modals when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
    
    // Close modals with close buttons
    document.querySelectorAll('.close-modal, .cancel-btn').forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Handle file input change
    document.getElementById('importFile').addEventListener('change', function(e) {
        const fileName = e.target.files[0]?.name || 'No file selected';
        document.getElementById('fileName').textContent = fileName;
    });
    
    // Handle import form submission
    document.getElementById('importForm').addEventListener('submit', function(e) {
        e.preventDefault();
        importData();
    });
    
    // Initialize data
    initializeData();
    
    // Add scroll event listener for infinite scrolling
    dataGrid.addEventListener('scroll', handleScroll);
    
    // Add collapsible dashboard
    const dashboardOverview = document.querySelector('.dashboard-overview');
    dashboardOverview.addEventListener('click', function(e) {
        if (document.body.classList.contains('dashboard-collapsed') && e.target === this) {
            document.body.classList.remove('dashboard-collapsed');
        }
    });
    
    // Auto-collapse dashboard after 3 seconds
    setTimeout(() => {
        document.body.classList.add('dashboard-collapsed');
    }, 3000);
    
    // Functions
    
    // Initialize data
    async function initializeData() {
        try {
            showLoading();
            
            // Fetch columns
            const columnsResponse = await fetch(`/columns?token=${token}`);
            if (!columnsResponse.ok) throw new Error('Failed to fetch columns');
            const columnsData = await columnsResponse.json();
            columns = columnsData.columns || [];
            
            // Fetch user preferences
            const preferencesResponse = await fetch(`/user/preferences?token=${token}`);
            if (!preferencesResponse.ok) throw new Error('Failed to fetch preferences');
            const preferencesData = await preferencesResponse.json();
            visibleColumns = preferencesData.columns || [
                "SITE_ID", "Site Name", "DISTRICT_COMMUNITY", "City/Road", 
                "Economical Region", "Lat", "Long", "Planning Status"
            ];
            
            // Populate column selector
            populateColumnSelector();
            
            // Populate search columns
            populateSearchColumns();
            
            // Fetch initial data
            await fetchData();
            
            // Fetch all data for map and statistics
            await fetchAllData();
            
        } catch (error) {
            console.error('Initialization error:', error);
            showToast('Error initializing data', 'error');
        } finally {
            hideLoading();
        }
    }
    
    // Fetch paginated data
    async function fetchData() {
        if (isLoading) return;
        
        try {
            isLoading = true;
            showLoading();
            
            const response = await fetch(`/data?offset=${currentOffset}&limit=${limit}&token=${token}`);
            if (!response.ok) throw new Error('Failed to fetch data');
            
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                // Append data to grid
                renderDataGrid(data.data);
                
                // Update offset for next fetch
                currentOffset += limit;
            } else if (currentOffset === 0) {
                // No data at all
                showNoData();
            }
            
        } catch (error) {
            console.error('Data fetch error:', error);
            showToast('Error fetching data', 'error');
        } finally {
            isLoading = false;
            hideLoading();
        }
    }
    
    // Fetch all data for map and statistics
    async function fetchAllData() {
        try {
            const response = await fetch(`/data/all?token=${token}`);
            if (!response.ok) throw new Error('Failed to fetch all data');
            
            const data = await response.json();
            allData = data.data || [];
            
            // Update statistics
            updateStatistics();
            
            // Update map
            updateMap();
            
        } catch (error) {
            console.error('All data fetch error:', error);
        }
    }
    
    // Render data grid
    function renderDataGrid(data) {
        // Create header row if it doesn't exist
        if (dataGridHeader.children.length === 0) {
            const headerRow = document.createElement('tr');
            
            // Add visible columns
            visibleColumns.forEach(column => {
                const th = document.createElement('th');
                th.textContent = column;
                headerRow.appendChild(th);
            });
            
            // Add actions column
            const actionsHeader = document.createElement('th');
            actionsHeader.textContent = 'Actions';
            headerRow.appendChild(actionsHeader);
            
            dataGridHeader.appendChild(headerRow);
        }
        
        // Add data rows
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.dataset.id = row.id;
            
            // Add visible columns
            visibleColumns.forEach(column => {
                const td = document.createElement('td');
                td.textContent = row[column] !== null && row[column] !== undefined ? row[column] : '';
                td.dataset.column = column;
                
                // Add click event for edit mode
                if (isEditMode) {
                    td.addEventListener('click', function() {
                        editCell(this, row.id, column);
                    });
                }
                
                tr.appendChild(td);
            });
            
            // Add actions column
            const actionsTd = document.createElement('td');
            actionsTd.classList.add('row-actions');
            
            const detailsBtn = document.createElement('button');
            detailsBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
            detailsBtn.title = 'View Details';
            detailsBtn.addEventListener('click', function() {
                showRowDetails(row);
            });
            
            actionsTd.appendChild(detailsBtn);
            tr.appendChild(actionsTd);
            
            dataGridBody.appendChild(tr);
        });
        
        // Hide no data message if we have data
        noDataMessage.style.display = 'none';
    }
    
    // Handle scroll for infinite scrolling
    function handleScroll() {
        const { scrollTop, scrollHeight, clientHeight } = dataGrid;
        
        if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoading) {
            fetchData();
        }
    }
    
    // Populate column selector
    function populateColumnSelector() {
        columnList.innerHTML = '';
        
        columns.forEach(column => {
            const div = document.createElement('div');
            div.classList.add('column-item');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `column-${column}`;
            checkbox.value = column;
            checkbox.checked = visibleColumns.includes(column);
            checkbox.addEventListener('change', function() {
                toggleColumn(column, this.checked);
            });
            
            const label = document.createElement('label');
            label.htmlFor = `column-${column}`;
            label.textContent = column;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            columnList.appendChild(div);
        });
    }
    
    // Populate search columns
    function populateSearchColumns() {
        searchColumns.innerHTML = '';
        
        columns.forEach(column => {
            const div = document.createElement('div');
            div.classList.add('search-column-item');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `search-column-${column}`;
            checkbox.value = column;
            
            const label = document.createElement('label');
            label.htmlFor = `search-column-${column}`;
            label.textContent = column;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            searchColumns.appendChild(div);
        });
    }
    
    // Toggle column visibility
    function toggleColumn(column, visible) {
        if (visible && !visibleColumns.includes(column)) {
            visibleColumns.push(column);
        } else if (!visible && visibleColumns.includes(column)) {
            visibleColumns = visibleColumns.filter(col => col !== column);
        }
        
        // Refresh grid
        refreshDataGrid();
    }
    
    // Refresh data grid
    function refreshDataGrid() {
        // Clear grid
        dataGridHeader.innerHTML = '';
        dataGridBody.innerHTML = '';
        
        // Reset offset
        currentOffset = 0;
        
        // Fetch data again
        fetchData();
    }
    
    // Toggle column dropdown
    function toggleColumnDropdown() {
        if (columnDropdown.style.display === 'block') {
            columnDropdown.style.display = 'none';
        } else {
            columnDropdown.style.display = 'block';
            // Close other dropdowns
            advancedSearchPanel.style.display = 'none';
        }
    }
    
    // Toggle advanced search
    function toggleAdvancedSearch() {
        if (advancedSearchPanel.style.display === 'block') {
            advancedSearchPanel.style.display = 'none';
        } else {
            advancedSearchPanel.style.display = 'block';
            // Close other dropdowns
            columnDropdown.style.display = 'none';
        }
    }
    
    // Apply advanced search
    async function applyAdvancedSearch() {
        const searchTerm = document.getElementById('searchTerm').value.trim();
        if (!searchTerm) {
            showToast('Please enter a search term', 'warning');
            return;
        }
        
        // Get selected columns
        const selectedColumns = [];
        document.querySelectorAll('#searchColumns input:checked').forEach(checkbox => {
            selectedColumns.push(checkbox.value);
        });
        
        try {
            showLoading();
            
            const response = await fetch(`/data/search?token=${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    term: searchTerm,
                    columns: selectedColumns
                })
            });
            
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            
            // Clear grid
            dataGridHeader.innerHTML = '';
            dataGridBody.innerHTML = '';
            
            // Render search results
            if (data.data && data.data.length > 0) {
                renderDataGrid(data.data);
                showToast(`Found ${data.count} results`, 'success');
            } else {
                showNoData();
                showToast('No results found', 'info');
            }
            
            // Close advanced search panel
            advancedSearchPanel.style.display = 'none';
            
        } catch (error) {
            console.error('Search error:', error);
            showToast('Error performing search', 'error');
        } finally {
            hideLoading();
        }
    }
    
    // Clear advanced search
    function clearAdvancedSearch() {
        document.getElementById('searchTerm').value = '';
        document.querySelectorAll('#searchColumns input').forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    // Handle global search
    async function handleGlobalSearch() {
        const searchTerm = globalSearch.value.trim();
        if (!searchTerm) {
            refreshDataGrid();
            return;
        }
        
        try {
            showLoading();
            
            const response = await fetch(`/data/search?token=${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    term: searchTerm,
                    columns: []
                })
            });
            
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            
            // Clear grid
            dataGridHeader.innerHTML = '';
            dataGridBody.innerHTML = '';
            
            // Render search results
            if (data.data && data.data.length > 0) {
                renderDataGrid(data.data);
            } else {
                showNoData();
            }
            
        } catch (error) {
            console.error('Global search error:', error);
        } finally {
            hideLoading();
        }
    }
    
    // Open import modal
    function openImportModal() {
        importModal.classList.add('active');
        document.getElementById('importFile').value = '';
        document.getElementById('fileName').textContent = 'No file selected';
        document.getElementById('importProgress').style.display = 'none';
    }
    
    // Import data
    async function importData() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        
        if (!file) {
            showToast('Please select a file', 'warning');
            return;
        }
        
        try {
            // Show progress
            const progressBar = document.querySelector('.progress-fill');
            const progressText = document.querySelector('.progress-text');
            document.getElementById('importProgress').style.display = 'block';
            
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            // Upload file
            const response = await fetch(`/data/import?token=${token}`, {
                method: 'POST',
                body: formData,
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    progressBar.style.width = `${percentCompleted}%`;
                    progressText.textContent = `${percentCompleted}%`;
                }
            });
            
            if (!response.ok) throw new Error('Import failed');
            
            const result = await response.json();
            
            // Show success message
            showToast(result.message, 'success');
            
            // Close modal
            closeAllModals();
            
            // Refresh data
            refreshDataGrid();
            fetchAllData();
            
        } catch (error) {
            console.error('Import error:', error);
            showToast('Error importing data', 'error');
        }
    }
    
    // Export data
    function exportData() {
        window.location.href = `/data/export?token=${token}`;
        showToast('Export started', 'info');
    }
    
    // Toggle edit mode
    function toggleEditMode() {
        isEditMode = !isEditMode;
        
        if (isEditMode) {
            document.body.classList.add('edit-mode');
            editModeBtn.classList.add('active');
            showToast('Edit mode enabled. Click on cells to edit.', 'info');
        } else {
            document.body.classList.remove('edit-mode');
            editModeBtn.classList.remove('active');
            
            // Save pending changes if any
            if (pendingChanges.length > 0) {
                saveChanges();
            }
        }
        
        // Refresh grid to add/remove click handlers
        refreshDataGrid();
    }
    
    // Edit cell
    function editCell(cell, rowId, column) {
        const currentValue = cell.textContent;
        
        // Create editor
        const editor = document.createElement('div');
        editor.classList.add('cell-editor-container');
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.classList.add('cell-editor');
        
        const actions = document.createElement('div');
        actions.classList.add('edit-actions');
        
        const saveBtn = document.createElement('button');
        saveBtn.innerHTML = '<i class="fas fa-check"></i>';
        saveBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const newValue = input.value;
            
            // Update cell
            cell.textContent = newValue;
            
            // Add to pending changes
            const existingChange = pendingChanges.find(change => change.id === rowId);
            if (existingChange) {
                existingChange.changes[column] = newValue;
            } else {
                pendingChanges.push({
                    id: rowId,
                    changes: { [column]: newValue }
                });
            }
            
            // Remove editor
            editor.remove();
            
            // Show toast
            showToast('Change pending. Save when done.', 'info');
        });
        
        const cancelBtn = document.createElement('button');
        cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
        cancelBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            editor.remove();
        });
        
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        
        editor.appendChild(input);
        editor.appendChild(actions);
        
        // Replace cell content with editor
        cell.textContent = '';
        cell.appendChild(editor);
        
        // Focus input
        input.focus();
    }
    
    // Save changes
    async function saveChanges() {
        if (pendingChanges.length === 0) return;
        
        try {
            showLoading();
            
            const response = await fetch(`/data/edit?token=${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    updates: pendingChanges
                })
            });
            
            if (!response.ok) throw new Error('Failed to save changes');
            
            const result = await response.json();
            
            // Show success message
            showToast(result.message, 'success');
            
            // Clear pending changes
            pendingChanges = [];
            
        } catch (error) {
            console.error('Save changes error:', error);
            showToast('Error saving changes', 'error');
        } finally {
            hideLoading();
        }
    }
    
    // Show row details
    function showRowDetails(row) {
        const content = document.getElementById('rowDetailsContent');
        content.innerHTML = '';
        
        // Create detail items for each column
        Object.entries(row).forEach(([key, value]) => {
            if (key === 'id') return; // Skip id
            
            const detailItem = document.createElement('div');
            detailItem.classList.add('detail-item');
            
            const label = document.createElement('div');
            label.classList.add('detail-label');
            label.textContent = key;
            
            const valueEl = document.createElement('div');
            valueEl.classList.add('detail-value');
            valueEl.textContent = value !== null && value !== undefined ? value : '';
            
            detailItem.appendChild(label);
            detailItem.appendChild(valueEl);
            content.appendChild(detailItem);
        });
        
        // Show modal
        rowDetailsModal.classList.add('active');
    }
    
    // Save columns as default
    async function saveColumnsAsDefault() {
        try {
            const response = await fetch(`/user/preferences?token=${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    preferences: {
                        columns: visibleColumns
                    }
                })
            });
            
            if (!response.ok) throw new Error('Failed to save preferences');
            
            const result = await response.json();
            
            // Show success message
            showToast('Column preferences saved', 'success');
            
            // Close dropdown
            columnDropdown.style.display = 'none';
            
        } catch (error) {
            console.error('Save preferences error:', error);
            showToast('Error saving preferences', 'error');
        }
    }
    
    // Reset columns
    function resetColumns() {
        visibleColumns = [
            "SITE_ID", "Site Name", "DISTRICT_COMMUNITY", "City/Road", 
            "Economical Region", "Lat", "Long", "Planning Status"
        ];
        
        // Update checkboxes
        document.querySelectorAll('#columnList input').forEach(checkbox => {
            checkbox.checked = visibleColumns.includes(checkbox.value);
        });
        
        // Refresh grid
        refreshDataGrid();
        
        // Show message
        showToast('Columns reset to default', 'info');
    }
    
    // Update statistics
    function updateStatistics() {
        if (!allData || allData.length === 0) return;
        
        // Total sites
        document.getElementById('totalSites').textContent = allData.length;
        
        // Count unique regions
        const regions = new Set();
        allData.forEach(item => {
            if (item['Economical Region']) {
                regions.add(item['Economical Region']);
            }
        });
        document.getElementById('totalRegions').textContent = regions.size;
        
        // Count planning statuses
        const statuses = {};
        allData.forEach(item => {
            const status = item['Planning Status'] || 'Unknown';
            statuses[status] = (statuses[status] || 0) + 1;
        });
        
        const topStatus = Object.entries(statuses)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => `${status}: ${count}`)
            .slice(0, 2)
            .join(', ');
        
        document.getElementById('planningStatus').textContent = topStatus;
        
        // Calculate network coverage (placeholder)
        document.getElementById('networkCoverage').textContent = '87% of population';
    }
    
    // Update map
    function updateMap() {
        if (!allData || allData.length === 0) return;
        
        // Clear existing markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
        
        // Add markers for each site with valid coordinates
        const markers = [];
        
        allData.forEach(item => {
            const lat = parseFloat(item['Lat']);
            const lng = parseFloat(item['Long']);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker([lat, lng]).addTo(map);
                
                // Add popup with site info
                marker.bindPopup(`
                    <strong>${item['Site Name'] || 'Unknown Site'}</strong><br>
                    ID: ${item['SITE_ID'] || 'N/A'}<br>
                    Region: ${item['Economical Region'] || 'N/A'}<br>
                    Status: ${item['Planning Status'] || 'N/A'}
                `);
                
                markers.push([lat, lng]);
            }
        });
        
        // Fit map to markers if any
        if (markers.length > 0) {
            map.fitBounds(markers);
        }
    }
    
    // Toggle theme
    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
    }
    
    // Logout
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/login-page';
    }
    
    // Show loading indicator
    function showLoading() {
        loadingIndicator.style.display = 'flex';
    }
    
    // Hide loading indicator
    function hideLoading() {
        loadingIndicator.style.display = 'none';
    }
    
    // Show no data message
    function showNoData() {
        noDataMessage.style.display = 'flex';
    }
    
    // Close all modals
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    
    // Show toast message
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon i');
        
        // Set message
        toastMessage.textContent = message;
        
        // Set icon based on type
        toastIcon.className = '';
        switch (type) {
            case 'success':
                toastIcon.className = 'fas fa-check-circle';
                toastIcon.style.color = 'var(--success)';
                break;
            case 'error':
                toastIcon.className = 'fas fa-times-circle';
                toastIcon.style.color = 'var(--error)';
                break;
            case 'warning':
                toastIcon.className = 'fas fa-exclamation-triangle';
                toastIcon.style.color = 'var(--warning)';
                break;
            case 'info':
                toastIcon.className = 'fas fa-info-circle';
                toastIcon.style.color = 'var(--info)';
                break;
        }
        
        // Show toast
        toast.classList.add('active');
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }
    
    // Debounce function
    function debounce(func, delay) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    // Add close button event for toast
    document.querySelector('.toast-close').addEventListener('click', function() {
        document.getElementById('toast').classList.remove('active');
    });
});