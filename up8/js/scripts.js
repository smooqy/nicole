document.querySelectorAll('.size-btn').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
    });
});


function showAd2(clickEvent) {
    if (typeof generatePixPayment === 'function') {
        return generatePixPayment(clickEvent || window.event);
    }
}
