function toggleLoginBox() {
    const loginBox = document.getElementById('loginBox');
    if (loginBox) {
        loginBox.classList.toggle('hidden');
    }
}

/*
    HOMEPAGE ANNOUNCEMENTS
    ----------------------
    Edit this array whenever you want to change the scrolling announcements
    on the homepage.
*/
const announcements = [
    "Announcement One",
    "Announcement Two",
    "Announcement Three"
];

function loadAnnouncements() {
    const announcementTrack = document.getElementById('announcementTrack');

    if (!announcementTrack) return;

    const announcementText = announcements.join("   •   ");
    announcementTrack.innerHTML = `<span>${announcementText}   •   ${announcementText}</span>`;
}

loadAnnouncements();