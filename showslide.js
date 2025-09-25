let slideIndex = 0;
let slideshowInterval;

function showSlides() {
    let slides = document.getElementsByClassName("slide");
    for (let i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    slideIndex++;
    if (slideIndex > slides.length) {
        slideIndex = 1;
    }
    slides[slideIndex - 1].style.display = "block";
    slideshowInterval = setTimeout(showSlides, 3000); // Change image every 3 seconds
}

function pauseSlideshow() {
    clearTimeout(slideshowInterval);
}

function resumeSlideshow() {
    showSlides();
}

showSlides();