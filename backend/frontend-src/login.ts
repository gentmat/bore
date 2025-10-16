const API_BASE = window.location.origin;

document.getElementById('loginForm')!.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    
    const email = (document.getElementById('email') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const errorMessage = document.getElementById('error-message')!;
    const submitBtn = (e.target as HTMLFormElement).querySelector('button[type="submit"]')!;
    const btnText = submitBtn.querySelector('.btn-text') as HTMLElement;
    const btnLoader = submitBtn.querySelector('.btn-loader') as HTMLElement;
    
    // Hide error message
    errorMessage.classList.remove('show');
    errorMessage.textContent = '';
    
    // Show loading state
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('user_name', data.name || email);
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
        
    } catch (error) {
        errorMessage.textContent = (error as Error).message || 'An error occurred. Please try again.';
        errorMessage.classList.add('show');
        
        // Reset button state
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
});

// Check if already logged in
if (localStorage.getItem('token')) {
    window.location.href = '/dashboard';
}
