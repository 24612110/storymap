document.addEventListener('DOMContentLoaded', function() {
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    if (tooltips.length > 0) {
        [...tooltips].map(tooltip => new bootstrap.Tooltip(tooltip));
    }
    const alerts = document.querySelectorAll('.alert-dismissible');
    if (alerts.length > 0) {
        alerts.forEach(alert => {
            setTimeout(() => {
                const dismissButton = alert.querySelector('.btn-close');
                if (dismissButton) {
                    dismissButton.click();
                }
            }, 5000);
        });
    }
});
