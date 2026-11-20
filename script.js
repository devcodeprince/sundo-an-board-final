// Google Apps Script URL — connects to our Google Sheets database
const API_URL = "https://script.google.com/macros/s/AKfycbyB33QsaF9G2bfGZKPV2KHAYp74mRZ7IPMe56zvH7D9BxpdLBvE5z1wtfot4L9RsRVi/exec";

// Wait for the entire HTML page to load before running any JavaScript
document.addEventListener('DOMContentLoaded', function() {
    var container = document.getElementById('announcements-container');
    var loadingText = document.getElementById('loading-text');
    var searchInput = document.getElementById('search-input');
    var filterButtons = document.querySelectorAll('.filter-btn');
    var allAnnouncements = [];
    var isAdminLoggedIn = false; // Becomes true only after Admin logs in

    // Fetches announcements from Google Sheets
    function fetchAnnouncements() {
        loadingText.style.display = 'block';

        fetch(API_URL, { redirect: 'follow' })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Server error: ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            allAnnouncements = data;
            loadingText.style.display = 'none';
            applyFilters();
        })
        .catch(function(error) {
            console.error('Failed to load announcements:', error);
            loadingText.style.display = 'none';
            container.innerHTML = '';

            var errorBox = document.createElement('div');
            errorBox.className = 'error-state';

            var errorMsg = document.createElement('p');
            errorMsg.textContent = 'Unable to load announcements. Please check your internet connection.';
            errorBox.appendChild(errorMsg);

            var retryBtn = document.createElement('button');
            retryBtn.className = 'filter-btn active';
            retryBtn.textContent = 'Retry';
            retryBtn.addEventListener('click', function() {
                container.innerHTML = '';
                container.appendChild(loadingText);
                fetchAnnouncements();
            });
            errorBox.appendChild(retryBtn);

            container.appendChild(errorBox);
        });
    }

    fetchAnnouncements();

    // Reads the array of visitor-pinned announcement IDs from browser localStorage
    function getUserPinnedIds() {
        try {
            var saved = localStorage.getItem('sundoan_pinned_ids');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    // Adds or removes an announcement ID from the visitor's personal pins
    function toggleUserPin(id) {
        var stringId = String(id);
        var pinnedIds = getUserPinnedIds();
        var index = pinnedIds.indexOf(stringId);

        if (index === -1) {
            pinnedIds.push(stringId);
        } else {
            pinnedIds.splice(index, 1);
        }

        localStorage.setItem('sundoan_pinned_ids', JSON.stringify(pinnedIds));
        applyFilters();
    }

    // Sends a delete request to Code.gs when Admin clicks Delete
    function deleteAnnouncement(id, title, buttonEl) {
        if (!confirm('Are you sure you want to delete "' + title + '"?')) {
            return;
        }

        if (buttonEl) {
            buttonEl.textContent = 'Deleting...';
            buttonEl.disabled = true;
        }

        fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            body: JSON.stringify({
                action: "delete",
                password: storedPassword,
                id: id
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.status === "success") {
                fetchAnnouncements();
            } else {
                alert('Failed to delete: ' + (data.message || data.status || 'Unknown error'));
                if (buttonEl) {
                    buttonEl.textContent = 'Delete';
                    buttonEl.disabled = false;
                }
            }
        })
        .catch(function(error) {
            console.error('Delete error:', error);
            alert('Network error while deleting. Please refresh to check if it was removed.');
            if (buttonEl) {
                buttonEl.textContent = 'Delete';
                buttonEl.disabled = false;
            }
        });
    }

    function displayAnnouncements(announcements) {
        // Reverse so newest posts come first, then float Official Barangay Pins to the top
        var announcementsSorted = announcements.slice().reverse().sort(function(a, b) {
            var aOfficial = a.pinned === true || String(a.pinned).toLowerCase() === 'true';
            var bOfficial = b.pinned === true || String(b.pinned).toLowerCase() === 'true';
            if (aOfficial && !bOfficial) return -1;
            if (!aOfficial && bOfficial) return 1;
            return 0;
        });

        var userPinnedIds = getUserPinnedIds();
        container.innerHTML = '';

        if (announcementsSorted.length === 0) {
            var emptyBox = document.createElement('div');
            emptyBox.className = 'empty-state';

            var emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No announcements found matching your search or filter.';
            emptyBox.appendChild(emptyMessage);

            container.appendChild(emptyBox);
            return;
        }

        for (var i = 0; i < announcementsSorted.length; i++) {
            var announcement = announcementsSorted[i];
            var stringId = String(announcement.id);
            var isOfficialPin = announcement.pinned === true || String(announcement.pinned).toLowerCase() === 'true';
            var isUserPin = userPinnedIds.indexOf(stringId) !== -1;

            // 1. Create the outer <div class="announcement-card">
            var card = document.createElement('div');
            card.className = 'announcement-card';

            // 2. Only create the <img> if imageUrl is a valid http/https link
            var rawImageUrl = String(announcement.imageUrl || '').trim();
            if (rawImageUrl.startsWith('https://') || rawImageUrl.startsWith('http://')) {
                var img = document.createElement('img');
                img.src = rawImageUrl;
                img.alt = String(announcement.title || 'Announcement image');
                img.className = 'card-image';
                card.appendChild(img);
            }

            // 3. Create top row for Category Badge + Pin Button (+ Delete Button if Admin)
            var cardHeader = document.createElement('div');
            cardHeader.className = 'card-header-row';

            var categoryBadge = document.createElement('span');
            categoryBadge.className = 'card-category';
            categoryBadge.textContent = String(announcement.category || 'general');
            cardHeader.appendChild(categoryBadge);

            var actionsGroup = document.createElement('div');
            actionsGroup.className = 'card-actions';

            var pinBtn = document.createElement('button');
            pinBtn.type = 'button';
            pinBtn.className = (isOfficialPin || isUserPin) ? 'pin-btn pinned' : 'pin-btn';

            if (isOfficialPin) {
                pinBtn.textContent = 'Official Pin';
                pinBtn.disabled = true;
            } else {
                pinBtn.textContent = isUserPin ? 'Pinned' : 'Pin';
                (function(targetId) {
                    pinBtn.addEventListener('click', function() {
                        toggleUserPin(targetId);
                    });
                })(stringId);
            }
            actionsGroup.appendChild(pinBtn);

            if (isAdminLoggedIn) {
                var deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = 'Delete';
                (function(targetId, targetTitle, btnRef) {
                    btnRef.addEventListener('click', function() {
                        deleteAnnouncement(targetId, targetTitle, btnRef);
                    });
                })(stringId, String(announcement.title || 'Announcement'), deleteBtn);
                actionsGroup.appendChild(deleteBtn);
            }

            cardHeader.appendChild(actionsGroup);
            card.appendChild(cardHeader);

            // 4. Create <h3> for the title
            var titleEl = document.createElement('h3');
            titleEl.textContent = String(announcement.title || '');
            card.appendChild(titleEl);

            // 5. Create <p class="card-meta"> for the date
            var metaEl = document.createElement('p');
            metaEl.className = 'card-meta';
            metaEl.textContent = String(announcement.date || '');
            card.appendChild(metaEl);

            // 6. Create <p> for the content
            var contentEl = document.createElement('p');
            contentEl.textContent = String(announcement.content || '');
            card.appendChild(contentEl);

            // 7. Attach the finished card to the page
            container.appendChild(card);
        }
    }

    var currentCategory = 'all';

    function applyFilters() {
        var searchTerm = searchInput.value.toLowerCase().trim();
        var userPinnedIds = getUserPinnedIds();

        var filtered = allAnnouncements.filter(function(announcement) {
            var cat = String(announcement.category || '').toLowerCase().trim();
            var title = String(announcement.title || '').toLowerCase();
            var content = String(announcement.content || '').toLowerCase();
            var isOfficialPin = announcement.pinned === true || String(announcement.pinned).toLowerCase() === 'true';
            var isUserPin = userPinnedIds.indexOf(String(announcement.id)) !== -1;
            var isPinned = isOfficialPin || isUserPin;

            var matchesCategory = false;
            if (currentCategory === 'all') {
                matchesCategory = true;
            } else if (currentCategory === 'pinned') {
                matchesCategory = isPinned;
            } else {
                matchesCategory = (cat === currentCategory);
            }

            var matchesSearch = title.includes(searchTerm) || content.includes(searchTerm);
            return matchesCategory && matchesSearch;
        });

        displayAnnouncements(filtered);
    }

    for (var i = 0; i < filterButtons.length; i++) {
        filterButtons[i].addEventListener('click', function() {
            currentCategory = this.dataset.category;
            for (var j = 0; j < filterButtons.length; j++) {
                filterButtons[j].classList.remove('active');
            }
            this.classList.add('active');
            applyFilters();
        });
    }

    searchInput.addEventListener('input', function() {
        applyFilters();
    });

    // ===== ADMIN LOGIN + LOGOUT =====
    var adminPasswordInput = document.getElementById('admin-password');
    var adminLoginBtn = document.getElementById('admin-login-btn');
    var adminLogoutBtn = document.getElementById('admin-logout-btn');
    var adminControls = document.getElementById('admin-controls');
    var storedPassword = "";

    // Allow pressing Enter inside the password box to trigger Login
    adminPasswordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            adminLoginBtn.click();
        }
    });

    adminLoginBtn.addEventListener('click', function() {
        var password = adminPasswordInput.value;
        if (!password) {
            alert('Palihug isulod ang password.');
            return;
        }

        adminLoginBtn.textContent = 'Checking...';
        adminLoginBtn.disabled = true;

        fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            body: JSON.stringify({
                action: "login",
                password: password
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.status === "success") {
                isAdminLoggedIn = true;
                storedPassword = password;
                adminControls.style.display = 'block';
                adminPasswordInput.style.display = 'none';
                adminLoginBtn.style.display = 'none';
                if (adminLogoutBtn) adminLogoutBtn.style.display = 'inline-block';
                applyFilters(); // Redraws cards to show Delete buttons
            } else {
                alert(data.message || 'Sayop ang password!');
                adminLoginBtn.textContent = 'Login';
                adminLoginBtn.disabled = false;
            }
        })
        .catch(function(error) {
            console.error('Login error:', error);
            alert('Network error while logging in. Please check your connection and try again.');
            adminLoginBtn.textContent = 'Login';
            adminLoginBtn.disabled = false;
        });
    });

    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', function() {
            isAdminLoggedIn = false;
            storedPassword = "";
            adminControls.style.display = 'none';
            adminLogoutBtn.style.display = 'none';
            adminPasswordInput.value = '';
            adminPasswordInput.style.display = 'inline-block';
            adminLoginBtn.textContent = 'Login';
            adminLoginBtn.disabled = false;
            adminLoginBtn.style.display = 'inline-block';
            applyFilters(); // Redraws cards to remove Delete buttons
        });
    }

    // ===== LIVE COMPOSER PREVIEW + PHOTO PICKER =====
    var adminTitleInput = document.getElementById('admin-title');
    var adminContentInput = document.getElementById('admin-content');
    var adminCategorySelect = document.getElementById('admin-category');
    var adminPinnedCheckbox = document.getElementById('admin-pinned');
    var adminImageFileInput = document.getElementById('admin-image-file');
    var uploadStatusText = document.getElementById('upload-status-text');

    var previewTitle = document.getElementById('preview-title');
    var previewContent = document.getElementById('preview-content');
    var previewCategory = document.getElementById('preview-category');
    var previewPin = document.getElementById('preview-pin');
    var previewImage = document.getElementById('preview-image');

    var selectedImageDataUrl = "";
    var cropControls = document.getElementById('image-crop-controls');
    var cropRatioSelect = document.getElementById('crop-ratio');
    var cropZoomInput = document.getElementById('crop-zoom');
    var zoomRow = document.getElementById('zoom-row');

    var rawUploadedImage = new Image();
    var hasLoadedImage = false;
    var panX = 0.5;
    var panY = 0.5;
    var isDraggingImage = false;
    var dragStartX = 0;
    var dragStartY = 0;

    function renderFramedImage() {
        if (!hasLoadedImage) return;

        var mode = cropRatioSelect ? cropRatioSelect.value : 'banner';
        var zoom = cropZoomInput ? parseFloat(cropZoomInput.value) : 1;
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');

        var imgW = rawUploadedImage.width;
        var imgH = rawUploadedImage.height;

        if (mode === 'fit') {
            if (zoomRow) zoomRow.style.display = 'none';
            var scaleFit = Math.min(1, 900 / Math.max(imgW, imgH));
            canvas.width = Math.round(imgW * scaleFit);
            canvas.height = Math.round(imgH * scaleFit);
            ctx.drawImage(rawUploadedImage, 0, 0, canvas.width, canvas.height);
        } else {
            if (zoomRow) zoomRow.style.display = 'flex';
            canvas.width = 800;
            canvas.height = (mode === 'square') ? 800 : 450;

            var baseScale = Math.max(canvas.width / imgW, canvas.height / imgH);
            var finalScale = baseScale * zoom;
            var drawW = imgW * finalScale;
            var drawH = imgH * finalScale;

            var maxOffsetX = Math.max(0, drawW - canvas.width);
            var maxOffsetY = Math.max(0, drawH - canvas.height);
            var offsetX = -panX * maxOffsetX;
            var offsetY = -panY * maxOffsetY;

            ctx.drawImage(rawUploadedImage, offsetX, offsetY, drawW, drawH);
        }

        selectedImageDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        previewImage.src = selectedImageDataUrl;
        previewImage.style.display = 'block';
    }

    function updateLivePreview() {
        var titleText = adminTitleInput.value.trim();
        var contentText = adminContentInput.value.trim();
        var categoryValue = adminCategorySelect.value;
        var isPinned = adminPinnedCheckbox.checked;

        previewTitle.textContent = titleText || 'Announcement Title Preview';
        previewContent.textContent = contentText || 'Start typing on the left or choose a photo to see how your announcement will look to residents.';
        previewCategory.textContent = categoryValue;

        if (isPinned) {
            previewPin.textContent = 'Official Pin';
            previewPin.className = 'pin-btn pinned';
        } else {
            previewPin.textContent = 'Pin';
            previewPin.className = 'pin-btn';
        }
    }

    adminTitleInput.addEventListener('input', updateLivePreview);
    adminContentInput.addEventListener('input', updateLivePreview);
    adminCategorySelect.addEventListener('change', updateLivePreview);
    adminPinnedCheckbox.addEventListener('change', updateLivePreview);

    if (cropRatioSelect) {
        cropRatioSelect.addEventListener('change', function() {
            panX = 0.5;
            panY = 0.5;
            renderFramedImage();
        });
    }
    if (cropZoomInput) {
        cropZoomInput.addEventListener('input', renderFramedImage);
    }

    previewImage.addEventListener('mousedown', function(e) {
        if (!hasLoadedImage || (cropRatioSelect && cropRatioSelect.value === 'fit')) return;
        isDraggingImage = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
    });

    window.addEventListener('mousemove', function(e) {
        if (!isDraggingImage) return;
        var dx = e.clientX - dragStartX;
        var dy = e.clientY - dragStartY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        panX = Math.max(0, Math.min(1, panX - dx / 300));
        panY = Math.max(0, Math.min(1, panY - dy / 300));
        renderFramedImage();
    });

    window.addEventListener('mouseup', function() {
        isDraggingImage = false;
    });

    adminImageFileInput.addEventListener('change', function() {
        var file = adminImageFileInput.files[0];
        if (!file) {
            hasLoadedImage = false;
            selectedImageDataUrl = "";
            previewImage.style.display = 'none';
            previewImage.src = '';
            if (cropControls) cropControls.style.display = 'none';
            uploadStatusText.textContent = 'Click to add a photo from your device';
            return;
        }

        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.indexOf(file.type) === -1) {
            alert('Please select a valid JPG, PNG, or WebP image.');
            adminImageFileInput.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Image is too large (max 5MB). Please pick a smaller image.');
            adminImageFileInput.value = '';
            return;
        }

        var reader = new FileReader();
        reader.onload = function(event) {
            rawUploadedImage.onload = function() {
                hasLoadedImage = true;
                panX = 0.5;
                panY = 0.5;
                if (cropZoomInput) cropZoomInput.value = '1';
                if (cropControls) cropControls.style.display = 'block';
                renderFramedImage();
                uploadStatusText.textContent = 'Selected: ' + file.name + ' (Click to change)';
            };
            rawUploadedImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // ===== ADMIN POST ANNOUNCEMENT =====
    var adminPostBtn = document.getElementById('admin-post-btn');

    adminPostBtn.addEventListener('click', function() {
        var title = adminTitleInput.value.trim();
        var content = adminContentInput.value.trim();
        var category = adminCategorySelect.value;
        var isPinned = adminPinnedCheckbox ? adminPinnedCheckbox.checked : false;

        if (!title || !content) {
            alert('Kinahanglan ang Title ug Content!');
            return;
        }

        adminPostBtn.textContent = 'Posting...';
        adminPostBtn.disabled = true;

        fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            body: JSON.stringify({
                action: "create",
                password: storedPassword,
                title: title,
                content: content,
                category: category,
                pinned: isPinned,
                imageBase64: selectedImageDataUrl
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.status === "success") {
                alert('Na-post na ang announcement!');
                adminTitleInput.value = '';
                adminContentInput.value = '';
                adminPinnedCheckbox.checked = false;
                adminImageFileInput.value = '';
                hasLoadedImage = false;
                selectedImageDataUrl = '';
                previewImage.style.display = 'none';
                previewImage.src = '';
                if (cropControls) cropControls.style.display = 'none';
                uploadStatusText.textContent = 'Click to add a photo from your device';
                updateLivePreview();
                fetchAnnouncements();
            } else {
                alert('Failed to post: ' + (data.message || data.status || 'Unknown error'));
            }
            adminPostBtn.textContent = 'Post Announcement';
            adminPostBtn.disabled = false;
        })
        .catch(function(error) {
            console.error('Post error:', error);
            alert('Network error while posting. Please check if the announcement appeared in the sheet before trying again.');
            adminPostBtn.textContent = 'Post Announcement';
            adminPostBtn.disabled = false;
        });
    });

}); // <-- End of DOMContentLoaded

function toggleAdmin() {
    var adminPanel = document.getElementById('admin-panel');
    if (adminPanel.style.display === 'none' || adminPanel.style.display === '') {
        adminPanel.style.display = 'block';
    } else {
        adminPanel.style.display = 'none';
    }
}