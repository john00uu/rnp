

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const logo = document.querySelector('.logo');

    window.addEventListener('load', () => {
        const overlay = document.getElementById('loadingOverlay');
        const logo = overlay.querySelector('.logo11 img');
        const appContainer = document.querySelector('.login-container');
    
        // Animate logo appearance
        gsap.to(logo, {
            duration: 1,
            opacity: 1,
            scale: 1.2,
            ease: "power2.out",
            onComplete: () => {
                // After logo appears, animate its exit
                gsap.to(logo, {
                    duration: 1,
                    scale: 0,
                    opacity: 0,
                    ease: "power2.in",
                });
    
                // Show the main content after fading out the logo
                gsap.to(overlay, {
                    duration: 1,
                    opacity: 0,
                    onComplete: () => {
                        overlay.style.display = 'none'; // Hides the overlay
                        appContainer.style.display = 'block'; // Shows the main content
                    }
                });
            }
        });
    });

    // Add 3D rotation effect on mouse move
    document.addEventListener('mousemove', function(e) {
        const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
        logo.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    });
    
    // Reset transform on mouse leave
    document.addEventListener('mouseleave', function() {
        logo.style.transform = 'rotateY(0) rotateX(0)';
    });
    
// Handle form submission
loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // Show loading state
    const loginButton = document.querySelector(".login-button");
    const buttonText = loginButton.querySelector(".button-text");
    const originalText = buttonText.textContent;
    buttonText.textContent = "Logging in...";
    loginButton.disabled = true;

    // Create form data
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
        let response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });

        if (!response.ok) {
            throw new Error("Invalid username or password");
        }

        let data = await response.json();

        // Store token in localStorage
        localStorage.setItem("token", data.access_token);

        // Redirect to main page
        window.location.href = "static/index.html";
    } catch (error) {
        // Show error message
        errorMessage.textContent = error.message;
        errorMessage.style.opacity = 1;

        // Reset button
        buttonText.textContent = originalText;
        loginButton.disabled = false;

        // Shake animation for error
        loginForm.classList.add("shake");
        setTimeout(() => {
            loginForm.classList.remove("shake");
        }, 500);
    }
});

    // Add animation to input fields
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.querySelector('i').style.color = 'var(--secondary)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.querySelector('i').style.color = 'var(--primary)';
        });
    });
});

// Add keyframe animation for shake effect
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
`;
document.head.appendChild(style);