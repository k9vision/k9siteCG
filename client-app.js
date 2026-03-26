        const API_BASE = '/api';

        // Toast Notification System
        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            const colors = {
                success: 'bg-green-600 border-green-400',
                error: 'bg-red-600 border-red-400',
                info: 'bg-blue-600 border-blue-400'
            };
            toast.className = `${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg border-l-4 flex items-center gap-3 min-w-[300px] max-w-md transform translate-x-full transition-transform duration-300`;
            const icons = { success: 'check_circle', error: 'error', info: 'info' };
            toast.innerHTML = `<span class="material-icons">${icons[type] || icons.info}</span><span class="flex-1">${message}</span><button onclick="this.parentElement.remove()" class="material-icons text-sm opacity-70 hover:opacity-100">close</button>`;
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.remove('translate-x-full'));
            setTimeout(() => {
                toast.classList.add('translate-x-full');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }

        let funFacts = [];
        let currentFactIndex = 0;
        let clientMediaItems = [];
        let bookingServicesCache = [];
        let mediaSortOrder = 'newest';

        // Loading spinner helpers
        function showLoading(containerId) {
            const el = document.getElementById(containerId);
            if (!el) return;
            el.dataset.prevHtml = el.innerHTML;
            el.innerHTML = `<div class="flex items-center justify-center py-6 gap-2">
                <svg class="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span class="text-sm text-gray-400 dark:text-gray-600">Loading...</span>
            </div>`;
        }

        function hideLoading(containerId) {
            // No-op; the load function replaces innerHTML anyway
        }

        function checkAuth() {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (!token || user.role !== 'client') {
                window.location.href = '/portal.html';
                return false;
            }
            return true;
        }

        function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }

        function getAuthHeaders() {
            return {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            };
        }

        function getNewFact() {
            if (funFacts.length === 0) {
                document.getElementById('fun-fact').textContent = 'No fun facts added yet by your trainer!';
                return;
            }

            currentFactIndex = (currentFactIndex + 1) % funFacts.length;
            document.getElementById('fun-fact').textContent = funFacts[currentFactIndex].fact;
        }

        async function loadFunFacts(clientId) {
            try {
                const res = await fetch(`${API_BASE}/fun-facts/client/${clientId}`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();

                if (data.success && data.facts && data.facts.length > 0) {
                    funFacts = data.facts;
                    document.getElementById('fun-fact').textContent = funFacts[0].fact;
                } else {
                    funFacts = [];
                    document.getElementById('fun-fact').textContent = 'No fun facts added yet by your trainer!';
                }
            } catch (error) {
                console.error('Error loading fun facts:', error);
                document.getElementById('fun-fact').textContent = 'No fun facts available';
            }
        }

        let currentClientId = null;
        let currentUserId = null;

        async function loadClientData() {
            if (!checkAuth()) return;
            showLoading('dogs-list');
            showLoading('media-list');
            showLoading('notes-list');

            const user = JSON.parse(localStorage.getItem('user'));

            try {
                // Load client info
                const clientRes = await fetch(`${API_BASE}/clients/user/${user.id}`, {
                    headers: getAuthHeaders()
                });
                const data = await clientRes.json();
                const client = data.client || data;

                if (client && client.id) {
                    currentClientId = client.id;
                    currentUserId = client.user_id || user.id;

                    // Show client name in welcome heading and profile
                    if (client.client_name) {
                        document.getElementById('welcome-heading').textContent = `Welcome, ${client.client_name}!`;
                        document.getElementById('profile-name-text').textContent = client.client_name;
                    }

                    // Show email in profile
                    if (client.email) {
                        document.getElementById('profile-email-text').textContent = client.email;
                    }

                    // Load dogs from dogs table
                    loadDogs(client.id);

                    // Update fun facts title with primary dog name
                    const dogName = client.dog_name || 'Your Dog';
                    document.getElementById('fun-facts-title').textContent = `Fun Dog Facts about ${dogName}`;

                    // Load fun facts
                    loadFunFacts(client.id);

                    // Load media
                    loadMedia(client.id);

                    // Load notes/conversation
                    loadNotes(client.id);
                } else {
                    document.getElementById('dogs-list').innerHTML = '<p class="text-gray-400 dark:text-gray-600">Profile not set up yet</p>';
                }
            } catch (error) {
                console.error('Error loading client data:', error);
            }
        }

        function toggleProfileEdit(show) {
            document.getElementById('profile-display').classList.toggle('hidden', show);
            document.getElementById('profile-edit').classList.toggle('hidden', !show);
            if (show) {
                document.getElementById('profile-name-input').value = document.getElementById('profile-name-text').textContent;
                const emailText = document.getElementById('profile-email-text').textContent;
                document.getElementById('profile-email-input').value = emailText !== '—' ? emailText : '';
            }
        }

        async function saveProfileName() {
            const client_name = document.getElementById('profile-name-input').value.trim();
            if (!client_name) { showToast('Name cannot be empty', 'error'); return; }
            try {
                const res = await fetch(`${API_BASE}/clients/user/${currentUserId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ client_name })
                });
                if (res.ok) {
                    document.getElementById('profile-name-text').textContent = client_name;
                    document.getElementById('welcome-heading').textContent = `Welcome, ${client_name}!`;
                    showToast('Name updated successfully!', 'success');
                } else {
                    showToast('Failed to update name', 'error');
                }
            } catch (error) {
                console.error('Save name error:', error);
                showToast('Failed to update name', 'error');
            }
        }

        async function saveProfileEmail() {
            const email = document.getElementById('profile-email-input').value.trim();
            if (!email) { showToast('Email cannot be empty', 'error'); return; }
            try {
                const res = await fetch(`${API_BASE}/clients/user/${currentUserId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ email })
                });
                if (res.ok) {
                    document.getElementById('profile-email-text').textContent = email;
                    showToast('Email updated successfully!', 'success');
                } else {
                    showToast('Failed to update email', 'error');
                }
            } catch (error) {
                console.error('Save email error:', error);
                showToast('Failed to update email', 'error');
            }
        }

        let clientDogs = []; // Store dogs for edit lookup

        async function loadDogs(clientId) {
            try {
                const res = await fetch(`${API_BASE}/dogs?client_id=${clientId}`, { headers: getAuthHeaders() });
                const data = await res.json();
                const dogs = data.dogs || [];
                clientDogs = dogs;
                const dogsList = document.getElementById('dogs-list');

                if (dogs.length > 0) {
                    dogsList.innerHTML = dogs.map(d => `
                        <div class="bg-background-dark dark:bg-gray-50 rounded-lg p-4 text-center">
                            <div class="relative w-20 h-20 mx-auto mb-3">
                                ${d.photo_url
                                    ? `<img src="${d.photo_url}" alt="${d.dog_name}" class="w-20 h-20 rounded-full object-cover">`
                                    : `<div class="w-20 h-20 rounded-full bg-primary flex items-center justify-center"><span class="material-icons text-4xl text-white">pets</span></div>`
                                }
                                <button onclick="openDogPhotoOptions(${d.id})" class="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 shadow-lg border-0">
                                    <span class="material-icons text-white text-sm">photo_camera</span>
                                </button>
                            </div>
                            <h4 class="text-lg font-bold">${d.dog_name}</h4>
                            <p class="text-sm text-gray-400 dark:text-gray-600">${d.breed || 'Breed unknown'}</p>
                            <p class="text-sm text-gray-400 dark:text-gray-600">${d.age ? d.age + ' years old' : ''}</p>
                            ${d.is_primary ? '<span class="inline-block mt-1 text-xs bg-primary text-white px-2 py-0.5 rounded">Primary</span>' : ''}
                            <button onclick="openEditDogModal(${d.id})" class="mt-2 text-sm text-primary hover:underline flex items-center justify-center gap-1"><span class="material-icons text-sm">edit</span>Edit</button>
                        </div>
                    `).join('');

                    // Update fun facts title with primary dog name
                    const primaryDog = dogs.find(d => d.is_primary) || dogs[0];
                    if (primaryDog) {
                        document.getElementById('fun-facts-title').textContent = `Fun Dog Facts about ${primaryDog.dog_name}`;
                    }
                } else {
                    dogsList.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No dogs added yet. Click "Add Dog" to get started!</p>';
                }
            } catch (error) {
                console.error('Error loading dogs:', error);
                document.getElementById('dogs-list').innerHTML = '<p class="text-gray-400 dark:text-gray-600">Failed to load dogs</p>';
            }
        }

        function showAddDogModal() {
            document.getElementById('add-dog-modal').classList.remove('hidden');
        }

        function closeAddDogModal() {
            document.getElementById('add-dog-modal').classList.add('hidden');
            document.getElementById('add-dog-form').reset();
        }

        // Edit Dog functions (F8: Client Self-Service)
        function openEditDogModal(dogId) {
            const dog = clientDogs.find(d => d.id === dogId);
            if (!dog) return showToast('Dog not found', 'error');
            document.getElementById('edit-dog-id').value = dogId;
            document.getElementById('edit-dog-name').value = dog.dog_name || '';
            document.getElementById('edit-dog-breed').value = dog.breed || '';
            document.getElementById('edit-dog-age').value = dog.age || '';
            document.getElementById('edit-dog-modal').classList.remove('hidden');
        }

        function closeEditDogModal() {
            document.getElementById('edit-dog-modal').classList.add('hidden');
            document.getElementById('edit-dog-form').reset();
        }

        document.getElementById('edit-dog-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const dogId = document.getElementById('edit-dog-id').value;
            const dog_name = document.getElementById('edit-dog-name').value.trim();
            const breed = document.getElementById('edit-dog-breed').value.trim();
            const age = document.getElementById('edit-dog-age').value;
            if (!dog_name) return showToast('Dog name is required', 'error');
            try {
                const res = await fetch(`${API_BASE}/dogs/${dogId}`, {
                    method: 'PUT',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dog_name, breed, age: age ? parseInt(age) : null })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Dog updated!', 'success');
                    closeEditDogModal();
                    loadDogs(currentClientId);
                } else {
                    showToast(data.error || 'Failed to update', 'error');
                }
            } catch (err) {
                console.error('Edit dog error:', err);
                showToast('Failed to update dog', 'error');
            }
        });

        async function uploadDogPhoto(dogId, input) {
            const file = input.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch(`${API_BASE}/dogs/${dogId}/photo`, {
                    method: 'POST',
                    headers: { 'Authorization': getAuthHeaders()['Authorization'] },
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    const clientId = JSON.parse(atob(localStorage.getItem('token').split('.')[1])).id;
                    const clientRes = await fetch(`${API_BASE}/clients/user/${clientId}`, { headers: getAuthHeaders() });
                    const clientData = await clientRes.json();
                    if (clientData.client) loadDogs(clientData.client.id);
                } else {
                    showToast(data.error || 'Failed to upload photo', 'error');
                }
            } catch (err) {
                console.error('Photo upload error:', err);
                showToast('Failed to upload photo', 'error');
            }
        }

        // DOG PROFILE PHOTO OPTIONS
        let dogPhotoTargetId = null;
        let dogPhotoStream = null;
        let dogPhotoBlobData = null;
        let dogPhotoFacingMode = 'environment';

        function openDogPhotoOptions(dogId) {
            dogPhotoTargetId = dogId;
            document.getElementById('dog-photo-options-modal').classList.remove('hidden');
        }

        function closeDogPhotoOptions() {
            document.getElementById('dog-photo-options-modal').classList.remove('hidden');
            document.getElementById('dog-photo-options-modal').classList.add('hidden');
        }

        function dogPhotoFromFile() {
            closeDogPhotoOptions();
            const input = document.getElementById('dog-photo-file-input');
            input.onchange = function() {
                if (input.files[0]) {
                    uploadDogPhoto(dogPhotoTargetId, input);
                }
            };
            input.click();
        }

        function dogPhotoFromCamera(facingMode) {
            closeDogPhotoOptions();
            dogPhotoFacingMode = facingMode;
            dogPhotoBlobData = null;
            const modal = document.getElementById('dog-photo-camera-modal');
            modal.classList.remove('hidden');
            document.getElementById('btn-dog-capture').classList.remove('hidden');
            document.getElementById('btn-dog-switch-camera').classList.remove('hidden');
            document.getElementById('btn-dog-retake').classList.add('hidden');
            document.getElementById('btn-dog-use-photo').classList.add('hidden');
            document.getElementById('dog-photo-snapshot').classList.add('hidden');
            document.getElementById('dog-photo-preview').classList.remove('hidden');

            startDogCameraStream(facingMode);
        }

        function startDogCameraStream(facingMode) {
            if (dogPhotoStream) dogPhotoStream.getTracks().forEach(t => t.stop());
            navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } })
                .then(stream => {
                    dogPhotoStream = stream;
                    const preview = document.getElementById('dog-photo-preview');
                    preview.srcObject = stream;
                    preview.play();
                })
                .catch(err => {
                    console.error('Camera access denied:', err);
                    showToast('Could not access camera. Please allow camera permissions and try again.', 'error');
                    closeDogPhotoCamera();
                });
        }

        function switchDogCamera() {
            dogPhotoFacingMode = dogPhotoFacingMode === 'environment' ? 'user' : 'environment';
            startDogCameraStream(dogPhotoFacingMode);
        }

        function captureDogPhoto() {
            const preview = document.getElementById('dog-photo-preview');
            const canvas = document.getElementById('dog-photo-canvas');
            const snapshot = document.getElementById('dog-photo-snapshot');

            canvas.width = preview.videoWidth;
            canvas.height = preview.videoHeight;
            canvas.getContext('2d').drawImage(preview, 0, 0);

            if (dogPhotoStream) dogPhotoStream.getTracks().forEach(t => t.stop());

            canvas.toBlob(blob => {
                dogPhotoBlobData = blob;
                snapshot.src = URL.createObjectURL(blob);
                snapshot.classList.remove('hidden');
                preview.classList.add('hidden');
                document.getElementById('btn-dog-capture').classList.add('hidden');
                document.getElementById('btn-dog-switch-camera').classList.add('hidden');
                document.getElementById('btn-dog-retake').classList.remove('hidden');
                document.getElementById('btn-dog-use-photo').classList.remove('hidden');
            }, 'image/jpeg', 0.9);
        }

        function retakeDogPhoto() {
            document.getElementById('dog-photo-snapshot').classList.add('hidden');
            document.getElementById('dog-photo-preview').classList.remove('hidden');
            document.getElementById('btn-dog-capture').classList.remove('hidden');
            document.getElementById('btn-dog-switch-camera').classList.remove('hidden');
            document.getElementById('btn-dog-retake').classList.add('hidden');
            document.getElementById('btn-dog-use-photo').classList.add('hidden');
            dogPhotoBlobData = null;
            startDogCameraStream(dogPhotoFacingMode);
        }

        async function useDogPhoto() {
            if (!dogPhotoBlobData) { showToast('No photo captured.', 'error'); return; }
            document.getElementById('btn-dog-use-photo').disabled = true;
            document.getElementById('btn-dog-use-photo').textContent = 'Uploading...';
            try {
                await uploadDogPhotoBlob(dogPhotoTargetId, dogPhotoBlobData);
            } finally {
                closeDogPhotoCamera();
            }
        }

        async function uploadDogPhotoBlob(dogId, blob) {
            const file = new File([blob], `dog_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch(`${API_BASE}/dogs/${dogId}/photo`, {
                    method: 'POST',
                    headers: { 'Authorization': getAuthHeaders()['Authorization'] },
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    const clientId = JSON.parse(atob(localStorage.getItem('token').split('.')[1])).id;
                    const clientRes = await fetch(`${API_BASE}/clients/user/${clientId}`, { headers: getAuthHeaders() });
                    const clientData = await clientRes.json();
                    if (clientData.client) loadDogs(clientData.client.id);
                } else {
                    showToast(data.error || 'Failed to upload photo', 'error');
                }
            } catch (err) {
                console.error('Photo upload error:', err);
                showToast('Failed to upload photo', 'error');
            }
        }

        function closeDogPhotoCamera() {
            if (dogPhotoStream) { dogPhotoStream.getTracks().forEach(t => t.stop()); dogPhotoStream = null; }
            const preview = document.getElementById('dog-photo-preview');
            preview.srcObject = null;
            document.getElementById('dog-photo-snapshot').src = '';
            document.getElementById('dog-photo-camera-modal').classList.add('hidden');
            const useBtn = document.getElementById('btn-dog-use-photo');
            useBtn.disabled = false;
            useBtn.innerHTML = '<span class="material-icons text-sm">check</span> Use Photo';
        }

        let noteMediaPending = false;

        async function loadMedia(clientId) {
            showLoading('media-list');
            const prevCount = clientMediaItems.length;
            try {
                const res = await fetch(`${API_BASE}/media/client/${clientId}`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                const media = data.media || data || [];
                clientMediaItems = Array.isArray(media) ? media : [];
                renderMediaGallery();

                // Auto-attach newly captured/uploaded media to note if pending
                if (noteMediaPending && clientMediaItems.length > prevCount) {
                    const newest = clientMediaItems.reduce((a, b) => {
                        const da = new Date(a.created_at || 0);
                        const db = new Date(b.created_at || 0);
                        return db > da ? b : a;
                    });
                    if (newest && !selectedNoteMediaIds.includes(newest.id)) {
                        selectedNoteMediaIds.push(newest.id);
                        updateMediaPreviewChip();
                        renderMediaPicker();
                        showToast('Media attached to your note!', 'success');
                    }
                    noteMediaPending = false;
                }
            } catch (error) {
                console.error('Error loading media:', error);
            }
        }

        function sortAndRenderMedia() {
            mediaSortOrder = document.getElementById('media-sort').value;
            renderMediaGallery();
        }

        function getMediaDisplayName(item, index) {
            if (item.caption) return item.caption;
            return item.type === 'photo' ? `Photo ${index + 1}` : `Video ${index + 1}`;
        }

        function getVideoMimeType(url) {
            if (/\.webm$/i.test(url)) return 'video/webm';
            if (/\.mov$/i.test(url)) return 'video/quicktime';
            return 'video/mp4';
        }

        let mediaSelectMode = false;
        let selectedMediaIds = new Set();

        function toggleMediaSelectMode() {
            mediaSelectMode = !mediaSelectMode;
            selectedMediaIds.clear();
            const toggleBtn = document.getElementById('media-select-toggle');
            const selectAllBtn = document.getElementById('media-select-all-btn');
            const bulkDeleteBtn = document.getElementById('media-bulk-delete-btn');
            const setAlbumBtn = document.getElementById('media-set-album-btn');
            toggleBtn.textContent = mediaSelectMode ? 'Cancel' : 'Select';
            toggleBtn.className = mediaSelectMode
                ? 'text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700'
                : 'text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500';
            selectAllBtn.classList.toggle('hidden', !mediaSelectMode);
            bulkDeleteBtn.classList.toggle('hidden', !mediaSelectMode);
            if (setAlbumBtn) setAlbumBtn.classList.toggle('hidden', !mediaSelectMode);
            updateSelectedCount();
            renderMediaGallery();
        }

        function toggleMediaSelect(id) {
            if (selectedMediaIds.has(id)) selectedMediaIds.delete(id);
            else selectedMediaIds.add(id);
            updateSelectedCount();
            const cb = document.getElementById(`media-cb-${id}`);
            if (cb) cb.checked = selectedMediaIds.has(id);
        }

        function selectAllMedia() {
            if (selectedMediaIds.size === clientMediaItems.length) {
                selectedMediaIds.clear();
            } else {
                clientMediaItems.forEach(m => selectedMediaIds.add(m.id));
            }
            updateSelectedCount();
            renderMediaGallery();
        }

        function updateSelectedCount() {
            const el = document.getElementById('media-selected-count');
            if (el) el.textContent = selectedMediaIds.size;
        }

        async function bulkDeleteMedia() {
            if (selectedMediaIds.size === 0) { showToast('No items selected', 'error'); return; }
            if (!confirm(`Delete ${selectedMediaIds.size} selected item(s)? This cannot be undone.`)) return;
            try {
                const res = await fetch(`${API_BASE}/media/bulk-delete`, {
                    method: 'POST',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [...selectedMediaIds] })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(`Deleted ${data.deleted} item(s)`, 'success');
                    selectedMediaIds.clear();
                    mediaSelectMode = false;
                    document.getElementById('media-select-toggle').textContent = 'Select';
                    document.getElementById('media-select-toggle').className = 'text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500';
                    document.getElementById('media-select-all-btn').classList.add('hidden');
                    document.getElementById('media-bulk-delete-btn').classList.add('hidden');
                    if (currentClientId) loadMedia(currentClientId);
                } else {
                    showToast(data.error || 'Bulk delete failed', 'error');
                }
            } catch (e) { showToast('Bulk delete failed', 'error'); }
        }

        function populateAlbumFilter() {
            const filter = document.getElementById('media-album-filter');
            if (!filter) return;
            const albums = [...new Set(clientMediaItems.map(m => m.album || '').filter(a => a))];
            const current = filter.value;
            filter.innerHTML = '<option value="">All Albums</option>' + albums.map(a => `<option value="${a}" ${a === current ? 'selected' : ''}>${a}</option>`).join('');
        }

        async function setAlbumForSelected() {
            if (selectedMediaIds.size === 0) return showToast('No items selected', 'error');
            const albumName = prompt('Enter album name (leave empty to remove from album):');
            if (albumName === null) return;
            try {
                const promises = [...selectedMediaIds].map(id =>
                    fetch(`${API_BASE}/media/${id}`, {
                        method: 'PUT',
                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ album: albumName.trim() })
                    })
                );
                await Promise.all(promises);
                showToast(`Updated album for ${selectedMediaIds.size} item(s)`, 'success');
                if (currentClientId) loadMedia(currentClientId);
            } catch (e) { showToast('Failed to set album', 'error'); }
        }

        async function saveMediaOrder(items) {
            try {
                await fetch(`${API_BASE}/media/reorder`, {
                    method: 'PUT',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items })
                });
            } catch (e) { console.error('Failed to save media order:', e); }
        }

        function renderMediaGallery() {
            const mediaList = document.getElementById('media-list');
            populateAlbumFilter();
            const albumFilter = (document.getElementById('media-album-filter') || {}).value || '';

            if (clientMediaItems.length > 0) {
                let filtered = albumFilter
                    ? clientMediaItems.filter(m => (m.album || '') === albumFilter)
                    : clientMediaItems;

                const sorted = [...filtered].sort((a, b) => {
                    if (a.sort_order !== b.sort_order) return (a.sort_order || 0) - (b.sort_order || 0);
                    const da = new Date(a.uploaded_at || a.created_at || 0);
                    const db = new Date(b.uploaded_at || b.created_at || 0);
                    return mediaSortOrder === 'newest' ? db - da : da - db;
                });
                mediaList.innerHTML = `<div id="media-grid" class="grid grid-cols-2 sm:grid-cols-3 gap-3">${sorted.map((item, i) => {
                    const idx = clientMediaItems.indexOf(item);
                    const dateStr = item.uploaded_at || item.created_at;
                    const dateHtml = dateStr ? `<p class="text-xs text-gray-500 mt-1">${new Date(dateStr).toLocaleDateString()}</p>` : '';
                    const displayName = getMediaDisplayName(item, i);
                    const albumBadge = item.album ? `<span class="text-xs bg-purple-600 text-white px-1 rounded">${item.album}</span>` : '';
                    const preview = item.type === 'photo'
                        ? `<img src="${item.url}" alt="${displayName}" class="rounded w-full h-32 object-cover cursor-pointer" onclick="${mediaSelectMode ? `toggleMediaSelect(${item.id})` : `openMediaLightbox(${idx})`}">`
                        : `<div class="bg-gray-700 dark:bg-gray-200 rounded flex flex-col items-center justify-center h-32 cursor-pointer" onclick="${mediaSelectMode ? `toggleMediaSelect(${item.id})` : `openMediaLightbox(${idx})`}">
                            <span class="material-icons text-3xl text-primary">play_circle</span>
                            <span class="text-xs mt-1 px-1 truncate w-full text-center">${displayName}</span>
                          </div>`;
                    const captionHtml = item.caption ? `<p class="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate" title="${item.caption}">${item.caption}</p>` : '';
                    const deleteBtn = mediaSelectMode ? '' : `<button onclick="deleteMedia(${item.id})" class="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600" title="Delete"><span class="material-icons text-sm">delete</span></button>`;
                    const checkbox = mediaSelectMode ? `<label class="absolute top-1 left-1 z-10"><input type="checkbox" id="media-cb-${item.id}" ${selectedMediaIds.has(item.id) ? 'checked' : ''} onchange="toggleMediaSelect(${item.id})" class="rounded border-gray-400 text-primary focus:ring-primary"></label>` : '';
                    const selectedBorder = mediaSelectMode && selectedMediaIds.has(item.id) ? 'ring-2 ring-primary rounded' : '';
                    return `<div class="relative group ${selectedBorder}" data-media-id="${item.id}">${checkbox}${preview}${deleteBtn}${captionHtml}${albumBadge}${dateHtml}</div>`;
                }).join('')}</div>`;

                // Initialize drag-and-drop if not in select mode
                if (!mediaSelectMode && typeof Sortable !== 'undefined') {
                    const grid = document.getElementById('media-grid');
                    if (grid) {
                        Sortable.create(grid, {
                            animation: 150,
                            ghostClass: 'opacity-50',
                            onEnd: function() {
                                const items = [];
                                grid.querySelectorAll('[data-media-id]').forEach((el, i) => {
                                    items.push({ id: parseInt(el.dataset.mediaId), sort_order: i });
                                });
                                saveMediaOrder(items);
                                // Update local data
                                items.forEach(item => {
                                    const m = clientMediaItems.find(mi => mi.id === item.id);
                                    if (m) m.sort_order = item.sort_order;
                                });
                            }
                        });
                    }
                }
            } else {
                mediaList.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No media files yet</p>';
            }
        }

        async function deleteMedia(mediaId) {
            if (!confirm('Delete this media? This cannot be undone.')) return;
            try {
                const res = await fetch(`${API_BASE}/media/${mediaId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    showToast('Media deleted', 'success');
                    if (currentClientId) loadMedia(currentClientId);
                } else {
                    const data = await res.json();
                    showToast(data.error || 'Failed to delete media', 'error');
                }
            } catch (error) {
                console.error('Delete media error:', error);
                showToast('Failed to delete media', 'error');
            }
        }

        function openMediaLightbox(index) {
            const item = clientMediaItems[index];
            if (!item) return;
            const modal = document.getElementById('media-lightbox-modal');
            const content = document.getElementById('lightbox-content');
            const displayName = getMediaDisplayName(item, index);
            document.getElementById('lightbox-filename').textContent = displayName;

            if (item.type === 'photo') {
                content.innerHTML = `<img src="${item.url}" alt="${displayName}" class="max-w-full max-h-[60vh] object-contain rounded">`;
            } else {
                const mimeType = getVideoMimeType(item.url);
                content.innerHTML = `<video controls autoplay playsinline class="max-w-full max-h-[60vh] rounded">
                    <source src="${item.url}" type="${mimeType}">
                    <p>Your browser does not support this video format. <a href="${item.url}" download class="text-primary underline">Download</a></p>
                </video>`;
            }

            const captionArea = document.getElementById('lightbox-caption-area');
            if (item.caption) {
                document.getElementById('lightbox-caption-text').textContent = item.caption;
                captionArea.classList.remove('hidden');
            } else {
                captionArea.classList.add('hidden');
            }
            modal.classList.remove('hidden');
        }

        function openMediaLightboxByUrl(url, filename) {
            const modal = document.getElementById('media-lightbox-modal');
            const content = document.getElementById('lightbox-content');
            document.getElementById('lightbox-filename').textContent = filename || 'Media';
            const isVideo = /\.(mp4|mov|webm|avi)$/i.test(url);
            if (isVideo) {
                const mimeType = getVideoMimeType(url);
                content.innerHTML = `<video controls autoplay playsinline class="max-w-full max-h-[60vh] rounded">
                    <source src="${url}" type="${mimeType}">
                    <p>Your browser does not support this video format. <a href="${url}" download class="text-primary underline">Download</a></p>
                </video>`;
            } else {
                content.innerHTML = `<img src="${url}" alt="${filename}" class="max-w-full max-h-[60vh] object-contain rounded">`;
            }
            const captionArea = document.getElementById('lightbox-caption-area');
            captionArea.classList.add('hidden');
            modal.classList.remove('hidden');
        }

        function closeMediaLightbox(event) {
            if (event && event.target !== event.currentTarget && !event.currentTarget.id) return;
            const modal = document.getElementById('media-lightbox-modal');
            const video = modal.querySelector('video');
            if (video) video.pause();
            modal.classList.add('hidden');
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('media-lightbox-modal');
                if (!modal.classList.contains('hidden')) closeMediaLightbox();
            }
        });

        async function loadNotes(clientId) {
            try {
                const res = await fetch(`${API_BASE}/notes/client/${clientId}`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                const notes = data.notes || [];

                // Notification badge: count unread trainer notes
                updateUnreadBadge(notes);

                const notesList = document.getElementById('notes-list');
                const conversation = document.getElementById('conversation');

                if (notes.length > 0) {
                    notesList.innerHTML = notes.slice(0, 3).map(note => {
                        const isTrainer = note.author_role !== 'client';
                        const label = isTrainer ? 'Trainer' : 'You';
                        const labelColor = isTrainer ? 'text-blue-400' : 'text-green-400';
                        const deleteBtn = !isTrainer ? `<button onclick="deleteNote(${note.id})" class="text-red-400 hover:text-red-300 ml-2" title="Delete"><span class="material-icons text-sm">delete</span></button>` : '';
                        return `
                        <div class="border border-border-dark dark:border-border-light rounded p-3">
                            <div class="flex items-center justify-between mb-1">
                                <h4 class="font-semibold">${note.title}</h4>
                                <div class="flex items-center">
                                    <span class="text-xs font-medium ${labelColor}">${label}</span>
                                    ${deleteBtn}
                                </div>
                            </div>
                            <p class="text-sm text-gray-400 dark:text-gray-600 mt-1">${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}</p>
                            <p class="text-xs text-gray-500 mt-2">${new Date(note.created_at).toLocaleString()}</p>
                        </div>`;
                    }).join('');

                    conversation.innerHTML = notes.map(note => {
                        const isTrainer = note.author_role !== 'client';
                        let mediaHtml = '';
                        // Multi-media support
                        if (note.media_items && note.media_items.length > 0) {
                            mediaHtml = '<div class="flex flex-wrap gap-2 mt-2">' + note.media_items.map(m => {
                                const displayName = m.caption || (m.type === 'video' ? 'Video' : m.original_name) || 'Media';
                                const safeName = displayName.replace(/'/g, "\\'");
                                if (m.type === 'photo') {
                                    return `<img src="${m.url}" alt="${displayName}" class="w-16 h-16 object-cover rounded cursor-pointer border border-gray-600 hover:opacity-80" onclick="openMediaLightboxByUrl('${m.url}', '${safeName}')">`;
                                } else {
                                    return `<div class="inline-flex items-center gap-1 bg-gray-700 dark:bg-gray-200 rounded px-2 py-1 cursor-pointer hover:bg-gray-600 dark:hover:bg-gray-300" onclick="openMediaLightboxByUrl('${m.url}', '${safeName}')"><span class="material-icons text-sm">play_circle</span><span class="text-xs">${displayName}</span></div>`;
                                }
                            }).join('') + '</div>';
                        } else if (note.media_url) {
                            // Backward compat: single media via media_id
                            const singleName = note.media_type === 'video' ? 'Video' : (note.media_original_name || note.media_filename || 'Photo');
                            const safeSingleName = singleName.replace(/'/g, "\\'");
                            if (note.media_type === 'photo') {
                                mediaHtml = `<img src="${note.media_url}" alt="${singleName}" class="w-24 h-24 object-cover rounded mt-2 cursor-pointer border border-gray-600 hover:opacity-80" onclick="openMediaLightboxByUrl('${note.media_url}', '${safeSingleName}')">`;
                            } else {
                                mediaHtml = `<div class="mt-2 inline-flex items-center gap-2 bg-gray-700 dark:bg-gray-200 rounded px-3 py-2 cursor-pointer hover:bg-gray-600 dark:hover:bg-gray-300" onclick="openMediaLightboxByUrl('${note.media_url}', '${safeSingleName}')"><span class="material-icons text-lg">play_circle</span><span class="text-xs">${singleName}</span></div>`;
                            }
                        }
                        if (isTrainer) {
                            return `
                            <div class="border-l-4 border-blue-500 pl-4 py-2">
                                <div class="flex items-start justify-between">
                                    <div class="flex-1">
                                        <span class="text-xs font-bold text-blue-400">Trainer</span>
                                        <h4 class="font-semibold text-blue-400">${note.title}</h4>
                                        <p class="text-sm mt-1">${note.content}</p>
                                        ${mediaHtml}
                                    </div>
                                    <span class="text-xs text-gray-500">${new Date(note.created_at).toLocaleString()}</span>
                                </div>
                            </div>`;
                        } else {
                            return `
                            <div class="border-r-4 border-green-500 pr-4 py-2 text-right">
                                <div class="flex items-start justify-between">
                                    <span class="text-xs text-gray-500">${new Date(note.created_at).toLocaleString()}</span>
                                    <div class="flex-1 ml-4">
                                        <div class="flex items-center justify-end gap-2">
                                            <span class="text-xs font-bold text-green-400">You</span>
                                            <button onclick="deleteNote(${note.id})" class="text-red-400 hover:text-red-300" title="Delete"><span class="material-icons text-sm">delete</span></button>
                                        </div>
                                        <h4 class="font-semibold text-green-400">${note.title}</h4>
                                        <p class="text-sm mt-1">${note.content}</p>
                                        ${mediaHtml}
                                    </div>
                                </div>
                            </div>`;
                        }
                    }).join('');
                } else {
                    notesList.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No notes yet</p>';
                    conversation.innerHTML = '<p class="text-gray-400 dark:text-gray-600">Start a conversation with your trainer!</p>';
                }
            } catch (error) {
                console.error('Error loading notes:', error);
            }
        }

        function showAddNote() {
            document.getElementById('add-note-modal').classList.remove('hidden');
        }

        function closeAddNote() {
            document.getElementById('add-note-modal').classList.add('hidden');
            document.getElementById('add-note-form').reset();
            clearMediaSelection();
            document.getElementById('media-picker-grid').classList.add('hidden');
        }

        let selectedNoteMediaIds = [];

        function toggleMediaPicker() {
            if (clientMediaItems.length === 0) {
                const hint = document.getElementById('no-media-hint');
                hint.classList.remove('hidden');
                setTimeout(() => hint.classList.add('hidden'), 2000);
                return;
            }
            const grid = document.getElementById('media-picker-grid');
            grid.classList.toggle('hidden');
            if (!grid.classList.contains('hidden')) renderMediaPicker();
        }

        function renderMediaPicker() {
            const container = document.getElementById('media-picker-items');
            container.innerHTML = clientMediaItems.map((item, i) => {
                const isSelected = selectedNoteMediaIds.includes(item.id);
                const ring = isSelected ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-600 dark:ring-gray-300';
                const checkMark = isSelected ? '<span class="absolute top-0.5 right-0.5 material-icons text-blue-400 text-sm bg-black bg-opacity-60 rounded-full">check_circle</span>' : '';
                const displayName = item.caption || (item.type === 'photo' ? `Photo ${i+1}` : `Video ${i+1}`);
                if (item.type === 'photo') {
                    return `<button type="button" onclick="selectMediaForNote(${item.id})" class="relative rounded overflow-hidden ${ring} aspect-square">
                        <img src="${item.url}" class="w-full h-full object-cover" alt="${displayName}">
                        ${checkMark}
                    </button>`;
                } else {
                    return `<button type="button" onclick="selectMediaForNote(${item.id})" class="relative rounded overflow-hidden ${ring} aspect-square bg-gray-800 dark:bg-gray-100 flex flex-col items-center justify-center">
                        <span class="material-icons text-blue-400 text-2xl">videocam</span>
                        <span class="text-xs truncate w-full px-1 text-center mt-1">${displayName}</span>
                        ${checkMark}
                    </button>`;
                }
            }).join('');
        }

        function selectMediaForNote(mediaId) {
            const idx = selectedNoteMediaIds.indexOf(mediaId);
            if (idx >= 0) {
                selectedNoteMediaIds.splice(idx, 1);
            } else {
                selectedNoteMediaIds.push(mediaId);
            }
            updateMediaPreviewChip();
            renderMediaPicker();
        }

        function selectAllMediaForNote() {
            selectedNoteMediaIds = clientMediaItems.map(m => m.id);
            updateMediaPreviewChip();
            renderMediaPicker();
        }

        function clearMediaSelection() {
            selectedNoteMediaIds = [];
            document.getElementById('note-media-ids').value = '[]';
            document.getElementById('media-preview-chip').classList.add('hidden');
            if (!document.getElementById('media-picker-grid').classList.contains('hidden')) {
                renderMediaPicker();
            }
        }

        function updateMediaPreviewChip() {
            const chip = document.getElementById('media-preview-chip');
            const name = document.getElementById('media-preview-name');
            document.getElementById('note-media-ids').value = JSON.stringify(selectedNoteMediaIds);

            if (selectedNoteMediaIds.length === 0) {
                chip.classList.add('hidden');
            } else {
                const count = selectedNoteMediaIds.length;
                name.textContent = count === 1
                    ? (clientMediaItems.find(m => m.id === selectedNoteMediaIds[0])?.caption || '1 item attached')
                    : `${count} items attached`;
                chip.classList.remove('hidden');
            }
        }

        // Note-specific capture functions: capture new media and auto-attach to note
        function noteCapturePhoto() {
            noteMediaPending = true;
            takePhoto();
        }

        function noteCaptureVideo() {
            noteMediaPending = true;
            takeVideo();
        }

        function noteUploadFile() {
            noteMediaPending = true;
            document.getElementById('note-file-input').click();
        }

        async function handleNoteFileUpload(input) {
            const file = input.files[0];
            if (!file) { noteMediaPending = false; return; }
            await uploadCapturedFile(file);
            input.value = '';
        }

        function showRequestService() {
            document.getElementById('request-service-modal').classList.remove('hidden');
        }

        function closeRequestService() {
            document.getElementById('request-service-modal').classList.add('hidden');
            document.getElementById('request-service-form').reset();
        }

        // Add Dog form submission
        document.getElementById('add-dog-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentClientId) { showToast('Client profile not loaded', 'error'); return; }

            const dog_name = document.getElementById('add-dog-name').value.trim();
            const breed = document.getElementById('add-dog-breed').value.trim();
            const age = parseInt(document.getElementById('add-dog-age').value) || null;

            if (!dog_name) { showToast('Dog name is required', 'error'); return; }

            try {
                const res = await fetch(`${API_BASE}/dogs`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ client_id: currentClientId, dog_name, breed, age })
                });

                if (res.ok) {
                    showToast('Dog added successfully! Your trainer has been notified.', 'success');
                    closeAddDogModal();
                    loadDogs(currentClientId);
                } else {
                    const data = await res.json();
                    showToast(data.error || 'Failed to add dog', 'error');
                }
            } catch (error) {
                console.error('Add dog error:', error);
                showToast('Failed to add dog', 'error');
            }
        });

        document.getElementById('add-note-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const user = JSON.parse(localStorage.getItem('user'));
            const subject = document.getElementById('note-subject').value;
            const message = document.getElementById('note-message').value;

            try {
                // Get client ID first
                const clientRes = await fetch(`${API_BASE}/clients/user/${user.id}`, {
                    headers: getAuthHeaders()
                });
                const data = await clientRes.json();
                const client = data.client || data;

                const noteBody = {
                    client_id: client.id,
                    title: subject,
                    content: message
                };
                const mediaIdsVal = JSON.parse(document.getElementById('note-media-ids').value || '[]');
                if (mediaIdsVal.length > 0) {
                    noteBody.media_ids = mediaIdsVal;
                    noteBody.media_id = mediaIdsVal[0]; // backward compat: first item as primary
                }

                const res = await fetch(`${API_BASE}/notes`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(noteBody)
                });

                if (res.ok) {
                    showToast('Message sent successfully!', 'success');
                    closeAddNote();
                    loadNotes(client.id);
                } else {
                    showToast('Failed to send message', 'error');
                }
            } catch (error) {
                console.error('Error sending note:', error);
                showToast('Failed to send message', 'error');
            }
        });

        document.getElementById('request-service-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const user = JSON.parse(localStorage.getItem('user'));
            const serviceType = document.getElementById('service-type').value;
            const details = document.getElementById('service-details').value;

            try {
                // Get client ID first
                const clientRes = await fetch(`${API_BASE}/clients/user/${user.id}`, {
                    headers: getAuthHeaders()
                });
                const data = await clientRes.json();
                const client = data.client || data;

                const res = await fetch(`${API_BASE}/notes`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        client_id: client.id,
                        title: `SERVICE REQUEST: ${serviceType}`,
                        content: details
                    })
                });

                if (res.ok) {
                    showToast('Service request sent successfully! Your trainer will contact you soon.', 'success');
                    closeRequestService();
                    loadNotes(client.id);
                } else {
                    showToast('Failed to send service request', 'error');
                }
            } catch (error) {
                console.error('Error sending service request:', error);
                showToast('Failed to send service request', 'error');
            }
        });

        // BOOKING FUNCTIONS
        let selectedSlot = null;

        async function loadAvailableSlots() {
            const date = document.getElementById('booking-date').value;
            if (!date) return;

            const container = document.getElementById('available-slots');
            container.innerHTML = '<p class="text-gray-400 dark:text-gray-600 text-sm">Loading...</p>';
            document.getElementById('booking-summary').classList.add('hidden');
            selectedSlot = null;

            try {
                const res = await fetch(`${API_BASE}/appointments/available-slots?date=${date}`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                const slots = data.available_slots || [];

                if (slots.length === 0) {
                    container.innerHTML = `<p class="text-gray-400 dark:text-gray-600 text-sm">${data.message || 'No available slots on this date'}</p>`;
                } else {
                    container.innerHTML = slots.map(s => `
                        <button type="button" onclick="selectSlot('${s.start_time}', '${s.end_time}')"
                            class="slot-btn px-4 py-2 rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors text-sm font-medium">
                            ${s.start_time} - ${s.end_time}
                        </button>
                    `).join('');
                }
            } catch (error) {
                console.error('Error loading slots:', error);
                container.innerHTML = '<p class="text-red-400 text-sm">Failed to load available times</p>';
            }
        }

        function selectSlot(startTime, endTime) {
            selectedSlot = { start_time: startTime, end_time: endTime };

            // Highlight selected button
            document.querySelectorAll('.slot-btn').forEach(btn => {
                btn.classList.remove('bg-primary', 'text-white');
                btn.classList.add('text-primary');
            });
            event.target.classList.add('bg-primary', 'text-white');
            event.target.classList.remove('text-primary');

            const date = document.getElementById('booking-date').value;
            document.getElementById('booking-selected-date').textContent = new Date(date + 'T00:00:00').toLocaleDateString();
            document.getElementById('booking-selected-time').textContent = `${startTime} - ${endTime}`;
            document.getElementById('booking-summary').classList.remove('hidden');

            loadBookingServices();
        }

        async function loadBookingServices() {
            try {
                const res = await fetch(`${API_BASE}/services`);
                const data = await res.json();
                bookingServicesCache = (data.services || []).filter(s => s.active);
                const select = document.getElementById('booking-service');
                select.innerHTML = '<option value="">General Training</option>' +
                    bookingServicesCache.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');
                document.getElementById('booking-service-detail').classList.add('hidden');
            } catch (error) {
                console.error('Error loading services:', error);
            }
        }

        function showServiceDetail() {
            const select = document.getElementById('booking-service');
            const detailDiv = document.getElementById('booking-service-detail');
            const serviceId = select.value;
            if (!serviceId) { detailDiv.classList.add('hidden'); return; }
            const svc = bookingServicesCache.find(s => String(s.id) === serviceId);
            if (svc && svc.description) {
                detailDiv.textContent = svc.description;
                detailDiv.classList.remove('hidden');
            } else {
                detailDiv.classList.add('hidden');
            }
        }

        async function confirmBooking() {
            if (!selectedSlot) return;

            const date = document.getElementById('booking-date').value;
            const serviceSelect = document.getElementById('booking-service');
            const serviceId = serviceSelect.value || null;
            const serviceName = serviceId ? serviceSelect.options[serviceSelect.selectedIndex].dataset.name : 'General Training';
            const notes = document.getElementById('booking-notes').value;

            try {
                const res = await fetch(`${API_BASE}/appointments`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        appointment_date: date,
                        start_time: selectedSlot.start_time,
                        end_time: selectedSlot.end_time,
                        service_id: serviceId ? parseInt(serviceId) : null,
                        service_name: serviceName,
                        notes
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    // Show confirmation modal
                    const details = document.getElementById('booking-confirm-details');
                    details.innerHTML = `
                        <p><strong>Date:</strong> ${new Date(date + 'T00:00:00').toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${selectedSlot.start_time} - ${selectedSlot.end_time}</p>
                        <p><strong>Service:</strong> ${serviceName}</p>
                    `;
                    document.getElementById('booking-confirm-modal').classList.remove('hidden');

                    document.getElementById('booking-summary').classList.add('hidden');
                    document.getElementById('booking-date').value = '';
                    document.getElementById('available-slots').innerHTML = '<p class="text-gray-400 dark:text-gray-600 text-sm">Pick a date to see available times</p>';
                    document.getElementById('booking-service-detail').classList.add('hidden');
                    selectedSlot = null;
                    loadMyAppointments();
                } else {
                    showToast(data.error || 'Failed to book appointment', 'error');
                }
            } catch (error) {
                console.error('Booking error:', error);
                showToast('Failed to book appointment', 'error');
            }
        }

        function closeBookingConfirmModal() {
            document.getElementById('booking-confirm-modal').classList.add('hidden');
        }

        async function loadMyAppointments() {
            showLoading('my-appointments');
            try {
                const res = await fetch(`${API_BASE}/appointments`, { headers: getAuthHeaders() });
                const data = await res.json();
                const appts = data.appointments || [];
                const container = document.getElementById('my-appointments');

                if (appts.length === 0) {
                    container.innerHTML = '<p class="text-gray-400 dark:text-gray-600 text-sm">No appointments yet. Book one above!</p>';
                } else {
                    const statusColors = { pending: 'bg-yellow-500', confirmed: 'bg-green-500', cancelled: 'bg-red-500', completed: 'bg-gray-500' };
                    container.innerHTML = appts.map(a => `
                        <div class="flex justify-between items-center p-4 border border-border-dark dark:border-border-light rounded">
                            <div>
                                <p class="font-semibold">${new Date(a.appointment_date + 'T00:00:00').toLocaleDateString()} at ${a.start_time} - ${a.end_time}</p>
                                ${a.service_name ? `<p class="text-sm text-gray-400 dark:text-gray-600">${a.service_name}</p>` : ''}
                                <span class="text-xs px-2 py-0.5 rounded text-white ${statusColors[a.status] || 'bg-gray-500'}">${a.status}</span>
                            </div>
                            <div class="flex gap-2">
                                ${a.status === 'pending' ? `<button onclick="confirmAppointment(${a.id})" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Confirm</button>` : ''}
                                ${['pending','confirmed'].includes(a.status) ? `<button onclick="showReschedule(${a.id}, '${a.appointment_date}', '${a.start_time}', '${a.end_time}')" class="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Reschedule</button>` : ''}
                                ${['pending','confirmed'].includes(a.status) ? `<button onclick="cancelAppointment(${a.id})" class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Cancel</button>` : ''}
                            </div>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Error loading appointments:', error);
            }
        }

        async function confirmAppointment(id) {
            try {
                const res = await fetch(`${API_BASE}/appointments/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: 'confirmed' })
                });
                if (res.ok) {
                    showToast('Appointment confirmed!', 'success');
                    loadMyAppointments();
                } else {
                    const data = await res.json();
                    showToast(data.error || 'Failed to confirm appointment', 'error');
                }
            } catch (error) {
                console.error('Confirm appointment error:', error);
                showToast('Failed to confirm appointment', 'error');
            }
        }

        async function cancelAppointment(id) {
            if (!confirm('Are you sure you want to cancel this appointment?')) return;
            try {
                const res = await fetch(`${API_BASE}/appointments/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: 'cancelled' })
                });
                if (res.ok) {
                    showToast('Appointment cancelled', 'success');
                    loadMyAppointments();
                } else {
                    showToast('Failed to cancel appointment', 'error');
                }
            } catch (error) {
                console.error('Cancel appointment error:', error);
            }
        }

        // MEDIA UPLOAD FUNCTIONS
        function showUploadMedia() {
            document.getElementById('upload-media-modal').classList.remove('hidden');
        }

        function closeUploadMedia() {
            document.getElementById('upload-media-modal').classList.add('hidden');
            document.getElementById('upload-media-form').reset();
        }

        document.getElementById('upload-media-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('upload-file').files[0];
            if (!file) { showToast('Please select a file', 'info'); return; }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('caption', document.getElementById('upload-caption').value || '');

            try {
                const res = await fetch(`${API_BASE}/media/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: formData
                });

                if (res.ok) {
                    showToast('Media uploaded successfully!', 'success');
                    closeUploadMedia();
                    const user = JSON.parse(localStorage.getItem('user'));
                    const clientRes = await fetch(`${API_BASE}/clients/user/${user.id}`, { headers: getAuthHeaders() });
                    const data = await clientRes.json();
                    const client = data.client || data;
                    if (client && client.id) loadMedia(client.id);
                } else {
                    const data = await res.json();
                    showToast(data.error || 'Upload failed', 'error');
                }
            } catch (error) {
                console.error('Upload error:', error);
                showToast('Upload failed', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });

        // Set minimum booking date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('booking-date').setAttribute('min', today);

        // INVOICE FUNCTIONS
        async function loadInvoices() {
            showLoading('my-invoices');
            try {
                const res = await fetch(`${API_BASE}/invoices`, { headers: getAuthHeaders() });
                const data = await res.json();
                const invoices = data.invoices || [];
                const container = document.getElementById('my-invoices');

                if (invoices.length === 0) {
                    container.innerHTML = '<p class="text-gray-400 dark:text-gray-600 text-sm">No invoices yet</p>';
                    return;
                }

                const statusColors = { pending: 'bg-yellow-500', paid: 'bg-green-500', overdue: 'bg-red-500', cancelled: 'bg-gray-500' };

                container.innerHTML = invoices.map(inv => {
                    const itemsHtml = (inv.items || []).map(item => {
                        const itemStatus = item.status || 'pending';
                        const itemStatusColor = itemStatus === 'paid' ? 'bg-green-500' : 'bg-yellow-500';
                        const amountPaid = Number(item.amount_paid || 0);
                        const itemTotal = Number(item.total);
                        const balance = itemTotal - amountPaid;
                        const dueDateDisplay = item.due_date ? new Date(item.due_date + 'T00:00:00').toLocaleDateString() : '—';
                        const balanceColor = balance <= 0 ? 'text-green-400' : 'text-yellow-400';
                        return `
                        <tr class="text-sm">
                            <td class="py-1">${item.service_name}</td>
                            <td class="py-1 text-center">${item.quantity}</td>
                            <td class="py-1 text-right">$${Number(item.price).toFixed(2)}</td>
                            <td class="py-1 text-right">$${itemTotal.toFixed(2)}</td>
                            <td class="py-1 text-center text-xs">${dueDateDisplay}</td>
                            <td class="py-1 text-right">$${amountPaid.toFixed(2)}</td>
                            <td class="py-1 text-right ${balanceColor}">$${balance.toFixed(2)}</td>
                            <td class="py-1 text-right"><span class="text-xs px-2 py-0.5 rounded text-white ${itemStatusColor}">${itemStatus}</span></td>
                        </tr>`;
                    }).join('');

                    return `
                    <div class="border border-border-dark dark:border-border-light rounded p-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-semibold">Invoice #${inv.invoice_number}</p>
                                <p class="text-sm text-gray-400 dark:text-gray-600">${new Date(inv.date).toLocaleDateString()}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-lg font-bold">$${Number(inv.total).toFixed(2)}</p>
                                <span class="text-xs px-2 py-0.5 rounded text-white ${statusColors[inv.status] || 'bg-gray-500'}">${inv.status}</span>
                                <button onclick='downloadInvoicePDF(${JSON.stringify(inv).replace(/'/g, "&#39;")})' class="mt-1 block text-xs bg-primary text-white px-2 py-1 rounded hover:bg-blue-700 flex items-center gap-1 ml-auto"><span class="material-icons text-xs">download</span>PDF</button>
                            </div>
                        </div>
                        <details class="mt-3">
                            <summary class="text-sm text-primary cursor-pointer hover:underline">View Details</summary>
                            <div class="mt-2 border-t border-border-dark dark:border-border-light pt-2">
                                <table class="w-full">
                                    <thead><tr class="text-xs text-gray-500 border-b border-border-dark dark:border-border-light">
                                        <th class="text-left py-1">Service</th><th class="text-center py-1">Qty</th><th class="text-right py-1">Price</th><th class="text-right py-1">Total</th><th class="text-center py-1">Due</th><th class="text-right py-1">Paid</th><th class="text-right py-1">Balance</th><th class="text-right py-1">Status</th>
                                    </tr></thead>
                                    <tbody>${itemsHtml}</tbody>
                                </table>
                                <div class="mt-2 pt-2 border-t border-border-dark dark:border-border-light text-sm space-y-1">
                                    <div class="flex justify-between"><span>Subtotal:</span><span>$${Number(inv.subtotal).toFixed(2)}</span></div>
                                    <div class="flex justify-between"><span>Tax (${inv.tax_rate}%):</span><span>$${Number(inv.tax_amount).toFixed(2)}</span></div>
                                    <div class="flex justify-between font-bold"><span>Total:</span><span>$${Number(inv.total).toFixed(2)}</span></div>
                                    ${inv.notes ? `<p class="text-xs text-gray-500 mt-1">${inv.notes}</p>` : ''}
                                    ${inv.due_date ? `<p class="text-xs text-gray-500">Due: ${new Date(inv.due_date).toLocaleDateString()}</p>` : ''}
                                </div>
                            </div>
                        </details>
                    </div>`;
                }).join('');
            } catch (error) {
                console.error('Error loading invoices:', error);
            }
        }

        // CAMERA CAPTURE FUNCTIONS
        let photoStream = null;
        let photoBlobData = null;

        function takePhoto() {
            document.getElementById('photo-capture-modal').classList.remove('hidden');
            document.getElementById('btn-capture-photo').classList.remove('hidden');
            document.getElementById('btn-retake-photo').classList.add('hidden');
            document.getElementById('btn-upload-photo').classList.add('hidden');
            document.getElementById('photo-snapshot').classList.add('hidden');
            document.getElementById('photo-preview').classList.remove('hidden');
            photoBlobData = null;

            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => {
                    photoStream = stream;
                    const preview = document.getElementById('photo-preview');
                    preview.srcObject = stream;
                    preview.play();
                })
                .catch(err => {
                    console.error('Camera access denied:', err);
                    showToast('Could not access camera. Please allow camera permissions and try again.', 'error');
                    closePhotoCapture();
                });
        }

        function capturePhoto() {
            const preview = document.getElementById('photo-preview');
            const canvas = document.getElementById('photo-canvas');
            const snapshot = document.getElementById('photo-snapshot');

            canvas.width = preview.videoWidth;
            canvas.height = preview.videoHeight;
            canvas.getContext('2d').drawImage(preview, 0, 0);

            if (photoStream) photoStream.getTracks().forEach(t => t.stop());

            canvas.toBlob(blob => {
                photoBlobData = blob;
                snapshot.src = URL.createObjectURL(blob);
                snapshot.classList.remove('hidden');
                preview.classList.add('hidden');
                document.getElementById('btn-capture-photo').classList.add('hidden');
                document.getElementById('btn-retake-photo').classList.remove('hidden');
                document.getElementById('btn-upload-photo').classList.remove('hidden');
            }, 'image/jpeg', 0.9);
        }

        function retakePhoto() {
            document.getElementById('photo-snapshot').classList.add('hidden');
            document.getElementById('photo-preview').classList.remove('hidden');
            document.getElementById('btn-capture-photo').classList.remove('hidden');
            document.getElementById('btn-retake-photo').classList.add('hidden');
            document.getElementById('btn-upload-photo').classList.add('hidden');
            photoBlobData = null;

            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => {
                    photoStream = stream;
                    const preview = document.getElementById('photo-preview');
                    preview.srcObject = stream;
                    preview.play();
                })
                .catch(err => {
                    console.error('Camera access denied:', err);
                    showToast('Could not access camera.', 'error');
                    closePhotoCapture();
                });
        }

        async function uploadCapturedPhoto() {
            if (!photoBlobData) { showToast('No photo captured.', 'error'); return; }
            const file = new File([photoBlobData], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            document.getElementById('btn-upload-photo').disabled = true;
            document.getElementById('btn-upload-photo').textContent = 'Uploading...';
            await uploadCapturedFile(file);
            closePhotoCapture();
        }

        function closePhotoCapture() {
            if (photoStream) { photoStream.getTracks().forEach(t => t.stop()); photoStream = null; }
            const preview = document.getElementById('photo-preview');
            preview.srcObject = null;
            document.getElementById('photo-snapshot').src = '';
            document.getElementById('photo-capture-modal').classList.add('hidden');
            document.getElementById('btn-upload-photo').disabled = false;
            document.getElementById('btn-upload-photo').textContent = '';
            document.getElementById('btn-upload-photo').innerHTML = '<span class="material-icons text-sm">cloud_upload</span> Upload';
        }

        let mediaStream = null;
        let mediaRecorder = null;
        let recordedChunks = [];
        let recordTimer = null;
        let recordSeconds = 0;

        function takeVideo() {
            document.getElementById('video-record-modal').classList.remove('hidden');
            document.getElementById('btn-start-record').classList.remove('hidden');
            document.getElementById('btn-stop-record').classList.add('hidden');
            document.getElementById('btn-upload-record').classList.add('hidden');
            document.getElementById('video-timer').classList.add('hidden');
            recordedChunks = [];

            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
                .then(stream => {
                    mediaStream = stream;
                    const preview = document.getElementById('video-preview');
                    preview.srcObject = stream;
                    preview.muted = true;
                    preview.play();
                })
                .catch(err => {
                    console.error('Camera access denied:', err);
                    showToast('Could not access camera. Please allow camera permissions and try again.', 'error');
                    closeVideoRecorder();
                });
        }

        function startRecording() {
            recordedChunks = [];
            recordSeconds = 0;
            const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
                : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm'
                : 'video/mp4';
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
            mediaRecorder.onstop = () => {
                clearInterval(recordTimer);
                const preview = document.getElementById('video-preview');
                const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
                preview.srcObject = null;
                preview.src = URL.createObjectURL(blob);
                preview.muted = false;
                preview.controls = true;
                preview.play();
            };
            mediaRecorder.start(1000);

            document.getElementById('btn-start-record').classList.add('hidden');
            document.getElementById('btn-stop-record').classList.remove('hidden');
            document.getElementById('video-timer').classList.remove('hidden');
            recordTimer = setInterval(() => {
                recordSeconds++;
                const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
                const s = String(recordSeconds % 60).padStart(2, '0');
                document.getElementById('video-timer').textContent = `${m}:${s}`;
            }, 1000);
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
            document.getElementById('btn-stop-record').classList.add('hidden');
            document.getElementById('btn-upload-record').classList.remove('hidden');
        }

        function closeVideoRecorder() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
            clearInterval(recordTimer);
            const preview = document.getElementById('video-preview');
            preview.srcObject = null;
            preview.src = '';
            preview.controls = false;
            document.getElementById('video-record-modal').classList.add('hidden');
        }

        async function uploadRecordedVideo() {
            if (recordedChunks.length === 0) { showToast('No video recorded.', 'error'); return; }
            const ext = mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
            const file = new File([blob], `recording_${Date.now()}.${ext}`, { type: mediaRecorder.mimeType });
            document.getElementById('btn-upload-record').disabled = true;
            document.getElementById('btn-upload-record').textContent = 'Uploading...';
            await uploadCapturedFile(file);
            closeVideoRecorder();
        }

        async function uploadCapturedFile(file) {
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('caption', '');

            try {
                const res = await fetch(`${API_BASE}/media/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: formData
                });

                if (res.ok) {
                    showToast('Media uploaded successfully!', 'success');
                    const user = JSON.parse(localStorage.getItem('user'));
                    const clientRes = await fetch(`${API_BASE}/clients/user/${user.id}`, { headers: getAuthHeaders() });
                    const data = await clientRes.json();
                    const client = data.client || data;
                    if (client && client.id) loadMedia(client.id);
                } else {
                    const data = await res.json();
                    showToast(data.error || 'Upload failed', 'error');
                }
            } catch (error) {
                console.error('Upload error:', error);
                showToast('Upload failed', 'error');
            }
        }

        // Notes polling - auto-refresh every 10s while tab is visible
        let currentClientIdForNotes = null;
        let notesPollingInterval = null;
        let lastNotesHash = null;

        const _originalLoadNotes = loadNotes;
        loadNotes = async function(clientId) {
            currentClientIdForNotes = clientId;
            await _originalLoadNotes(clientId);
        };

        async function pollNotes() {
            if (!currentClientIdForNotes) return;
            try {
                const res = await fetch(`${API_BASE}/notes/client/${currentClientIdForNotes}`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                const notesList = data.notes || [];
                const newHash = JSON.stringify(notesList.map(n => n.id + ':' + n.created_at + ':' + (n.updated_at || '')));
                if (lastNotesHash !== null && newHash === lastNotesHash) return;
                lastNotesHash = newHash;
                await _originalLoadNotes(currentClientIdForNotes);
            } catch (e) { /* silent */ }
        }

        function startNotesPolling() {
            if (notesPollingInterval) return;
            notesPollingInterval = setInterval(pollNotes, 10000);
        }

        function stopNotesPolling() {
            if (notesPollingInterval) {
                clearInterval(notesPollingInterval);
                notesPollingInterval = null;
            }
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopNotesPolling();
            } else {
                startNotesPolling();
            }
        });

        startNotesPolling();

        // RESCHEDULE FUNCTIONS
        function showReschedule(appointmentId, currentDate, currentStart, currentEnd) {
            document.getElementById('reschedule-id').value = appointmentId;
            document.getElementById('reschedule-date').value = currentDate;
            document.getElementById('reschedule-start').value = currentStart;
            document.getElementById('reschedule-end').value = currentEnd;
            document.getElementById('reschedule-modal').classList.remove('hidden');
        }

        document.getElementById('reschedule-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('reschedule-id').value;
            const appointment_date = document.getElementById('reschedule-date').value;
            const start_time = document.getElementById('reschedule-start').value;
            const end_time = document.getElementById('reschedule-end').value;
            const token = localStorage.getItem('token');

            try {
                const res = await fetch(`/api/appointments/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ appointment_date, start_time, end_time })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Appointment rescheduled successfully!', 'success');
                    document.getElementById('reschedule-modal').classList.add('hidden');
                    loadMyAppointments();
                } else {
                    showToast(data.error || 'Failed to reschedule', 'error');
                }
            } catch (err) {
                showToast('Failed to reschedule', 'error');
            }
        });

        // TRAINING PROGRESS / MILESTONES
        async function loadMilestones() {
            showLoading('milestones-list');
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/milestones', { headers: { 'Authorization': `Bearer ${token}` } });
                if (!res.ok) return;
                const data = await res.json();
                const milestones = data.milestones || [];
                const total = milestones.length;
                const completed = milestones.filter(m => m.status === 'completed').length;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                document.getElementById('progress-label').textContent = `${completed} of ${total} milestones completed`;
                document.getElementById('progress-percent').textContent = `${percent}%`;
                document.getElementById('progress-fill').style.width = `${percent}%`;

                const container = document.getElementById('milestones-list');
                if (milestones.length === 0) {
                    container.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No training milestones yet. Your trainer will add them as you progress!</p>';
                    return;
                }

                const statusIcons = { completed: 'check_circle', in_progress: 'pending', not_started: 'radio_button_unchecked' };
                const statusColors = { completed: 'text-green-500', in_progress: 'text-yellow-500', not_started: 'text-gray-500' };
                const statusLabels = { completed: 'Completed', in_progress: 'In Progress', not_started: 'Not Started' };

                // Group milestones by dog (F15: Multi-Dog Milestone Tracking)
                const groups = {};
                milestones.forEach(m => {
                    const key = m.dog_name || 'General Training';
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(m);
                });

                let html = '';
                for (const [dogName, dogMilestones] of Object.entries(groups)) {
                    const dogCompleted = dogMilestones.filter(m => m.status === 'completed').length;
                    const dogTotal = dogMilestones.length;
                    const dogPercent = dogTotal > 0 ? Math.round((dogCompleted / dogTotal) * 100) : 0;
                    html += `<div class="mb-4">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="material-icons text-primary text-sm">pets</span>
                            <h4 class="font-bold text-sm">${dogName}</h4>
                            <span class="text-xs text-gray-500">${dogCompleted}/${dogTotal} (${dogPercent}%)</span>
                        </div>
                        <div class="w-full bg-gray-700 dark:bg-gray-200 rounded-full h-2 mb-3">
                            <div class="bg-green-500 h-2 rounded-full transition-all duration-500" style="width: ${dogPercent}%"></div>
                        </div>`;
                    html += dogMilestones.map(m => `
                        <div class="flex items-start gap-3 p-3 rounded-lg bg-background-dark dark:bg-gray-50 mb-2">
                            <span class="material-icons ${statusColors[m.status]} mt-0.5">${statusIcons[m.status]}</span>
                            <div class="flex-1">
                                <p class="font-semibold">${m.title}</p>
                                ${m.description ? `<p class="text-sm text-gray-400 dark:text-gray-600">${m.description}</p>` : ''}
                                <p class="text-xs text-gray-500 mt-1">${statusLabels[m.status]}${m.completed_at ? ` - ${new Date(m.completed_at).toLocaleDateString()}` : ''}</p>
                            </div>
                        </div>
                    `).join('');
                    html += '</div>';
                }
                container.innerHTML = html;
            } catch (e) { console.error('Failed to load milestones:', e); }
        }

        // INVOICE PDF DOWNLOAD — matches server-side email PDF layout exactly
        async function downloadInvoicePDF(invoice) {
            try {
                const { PDFDocument, rgb, StandardFonts } = PDFLib;
                const pdfDoc = await PDFDocument.create();
                let currentPage = pdfDoc.addPage([612, 792]);
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

                const BLUE = rgb(0.231, 0.510, 0.965);
                const DARK = rgb(0.122, 0.161, 0.216);
                const GRAY = rgb(0.42, 0.45, 0.49);
                const LIGHT_BG = rgb(0.976, 0.980, 0.984);
                const LINE_COLOR = rgb(0.9, 0.91, 0.92);
                const GREEN = rgb(0.294, 0.871, 0.498);
                const RED = rgb(0.973, 0.443, 0.443);

                const margin = 50;
                const pageWidth = 612 - margin * 2;
                let y = 742;

                function checkPageBreak(needed) {
                    if (y < needed) {
                        currentPage = pdfDoc.addPage([612, 792]);
                        y = 742;
                    }
                }

                // --- Logo + Header ---
                try {
                    const logoRes = await fetch('/k9visionlogo.jpeg');
                    if (logoRes.ok) {
                        const logoBytes = new Uint8Array(await logoRes.arrayBuffer());
                        const logoImage = await pdfDoc.embedJpg(logoBytes);
                        const logoDims = logoImage.scaleToFit(80, 80);
                        currentPage.drawImage(logoImage, { x: margin, y: y - logoDims.height, width: logoDims.width, height: logoDims.height });
                        currentPage.drawText('K9 Vision', { x: margin + 90, y: y - 25, size: 24, font: boldFont, color: BLUE });
                        currentPage.drawText('Dog Training Services', { x: margin + 90, y: y - 45, size: 12, font, color: GRAY });
                        y -= 90;
                    } else { throw new Error('no logo'); }
                } catch {
                    currentPage.drawText('K9 Vision', { x: margin, y, size: 28, font: boldFont, color: BLUE });
                    y -= 20;
                    currentPage.drawText('Dog Training Services', { x: margin, y, size: 12, font, color: GRAY });
                    y -= 30;
                }

                // --- Invoice number ---
                y -= 10;
                currentPage.drawText(`Invoice #${invoice.invoice_number}`, { x: margin, y, size: 18, font: boldFont, color: DARK });
                y -= 25;

                // --- Info fields ---
                const infoFields = [
                    ['Date', invoice.date ? new Date(invoice.date + 'T00:00:00').toLocaleDateString() : ''],
                    ['Due Date', invoice.due_date ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString() : null],
                    ['Trainer', invoice.trainer_name],
                ];
                for (const [label, value] of infoFields) {
                    if (!value) continue;
                    const labelText = `${label}: `;
                    const labelWidth = boldFont.widthOfTextAtSize(labelText, 10);
                    currentPage.drawText(labelText, { x: margin, y, size: 10, font: boldFont, color: DARK });
                    currentPage.drawText(value, { x: margin + labelWidth, y, size: 10, font, color: GRAY });
                    y -= 16;
                }

                // --- Bill To ---
                y -= 10;
                currentPage.drawText('Bill To:', { x: margin, y, size: 12, font: boldFont, color: DARK });
                y -= 16;
                currentPage.drawText(invoice.client_name || '', { x: margin, y, size: 10, font: boldFont, color: DARK });
                y -= 16;
                const dogInfo = `${invoice.dog_name || ''}${invoice.dog_breed ? ` (${invoice.dog_breed})` : ''}`;
                if (dogInfo.trim()) {
                    currentPage.drawText(`Dog: ${dogInfo}`, { x: margin, y, size: 10, font, color: GRAY });
                    y -= 16;
                }

                // --- Line items table ---
                y -= 15;
                const colX = [margin, margin + 150, margin + 185, margin + 235, margin + 290, margin + 350, margin + 400, margin + 450];
                const colLabels = ['Service', 'Qty', 'Price', 'Total', 'Due Date', 'Upfront', 'Paid', 'Balance'];
                const colAligns = ['left', 'center', 'right', 'right', 'center', 'center', 'right', 'right'];

                // Table header background
                currentPage.drawRectangle({ x: margin - 5, y: y - 4, width: pageWidth + 10, height: 20, color: LIGHT_BG });
                for (let i = 0; i < colLabels.length; i++) {
                    const textWidth = boldFont.widthOfTextAtSize(colLabels[i], 9);
                    let xPos = colX[i];
                    if (colAligns[i] === 'right') xPos = colX[i] + 50 - textWidth;
                    else if (colAligns[i] === 'center') xPos = colX[i] + 25 - textWidth / 2;
                    currentPage.drawText(colLabels[i], { x: xPos, y, size: 9, font: boldFont, color: DARK });
                }
                y -= 6;
                currentPage.drawLine({ start: { x: margin - 5, y }, end: { x: margin + pageWidth + 5, y }, thickness: 1, color: LINE_COLOR });
                y -= 16;

                // Table rows
                const items = invoice.items || [];
                for (const item of items) {
                    checkPageBreak(80);
                    const itemTotal = Number(item.total || 0);
                    const amountPaid = Number(item.amount_paid || 0);
                    const balance = itemTotal - amountPaid;
                    const dueDateStr = item.due_date ? new Date(item.due_date + 'T00:00:00').toLocaleDateString() : '\u2014';
                    const upfrontPct = Number(item.upfront_pct || 0);
                    const rowValues = [
                        item.service_name || 'Service',
                        String(item.quantity || 0),
                        `$${Number(item.price || 0).toFixed(2)}`,
                        `$${itemTotal.toFixed(2)}`,
                        dueDateStr,
                        `${upfrontPct}%`,
                        `$${amountPaid.toFixed(2)}`,
                        `$${balance.toFixed(2)}`
                    ];
                    for (let i = 0; i < rowValues.length; i++) {
                        const text = rowValues[i];
                        const displayText = i === 0 && text.length > 25 ? text.substring(0, 22) + '...' : text;
                        const textWidth = font.widthOfTextAtSize(displayText, 9);
                        let xPos = colX[i];
                        if (colAligns[i] === 'right') xPos = colX[i] + 50 - textWidth;
                        else if (colAligns[i] === 'center') xPos = colX[i] + 25 - textWidth / 2;
                        currentPage.drawText(displayText, { x: xPos, y, size: 9, font, color: DARK });
                    }
                    y -= 6;
                    currentPage.drawLine({ start: { x: margin - 5, y }, end: { x: margin + pageWidth + 5, y }, thickness: 0.5, color: LINE_COLOR });
                    y -= 16;
                }

                // --- Totals section ---
                checkPageBreak(120);
                y -= 5;
                const totalsX = margin + 320;
                const valuesX = margin + 420;

                const totalsData = [
                    ['Subtotal:', `$${Number(invoice.subtotal || 0).toFixed(2)}`],
                ];
                if (Number(invoice.discount_amount || 0) > 0) {
                    const discLabel = invoice.discount_type === 'percentage' ? `Discount (${invoice.discount_value}%):` : 'Discount:';
                    totalsData.push([discLabel, `-$${Number(invoice.discount_amount).toFixed(2)}`]);
                }
                totalsData.push([`Tax (${invoice.tax_rate || 0}%):`, `$${Number(invoice.tax_amount || 0).toFixed(2)}`]);

                for (const [label, value] of totalsData) {
                    currentPage.drawText(label, { x: totalsX, y, size: 10, font, color: GRAY });
                    const valWidth = font.widthOfTextAtSize(value, 10);
                    currentPage.drawText(value, { x: valuesX + 70 - valWidth, y, size: 10, font, color: DARK });
                    y -= 18;
                }

                // Blue total line
                currentPage.drawLine({ start: { x: totalsX, y: y + 12 }, end: { x: valuesX + 70, y: y + 12 }, thickness: 1, color: BLUE });
                const totalValue = `$${Number(invoice.total || 0).toFixed(2)}`;
                currentPage.drawText('Total:', { x: totalsX, y, size: 14, font: boldFont, color: BLUE });
                const totalValWidth = boldFont.widthOfTextAtSize(totalValue, 14);
                currentPage.drawText(totalValue, { x: valuesX + 70 - totalValWidth, y, size: 14, font: boldFont, color: BLUE });
                y -= 22;

                // Total Paid & Balance Due
                const totalPaid = items.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
                const balanceDue = Number(invoice.total || 0) - totalPaid;

                const tpValue = `$${totalPaid.toFixed(2)}`;
                currentPage.drawText('Total Paid:', { x: totalsX, y, size: 10, font, color: GREEN });
                const tpWidth = font.widthOfTextAtSize(tpValue, 10);
                currentPage.drawText(tpValue, { x: valuesX + 70 - tpWidth, y, size: 10, font: boldFont, color: GREEN });
                y -= 18;

                const bdValue = `$${balanceDue.toFixed(2)}`;
                const bdColor = balanceDue <= 0 ? GREEN : RED;
                currentPage.drawText('Balance Due:', { x: totalsX, y, size: 12, font: boldFont, color: bdColor });
                const bdWidth = boldFont.widthOfTextAtSize(bdValue, 12);
                currentPage.drawText(bdValue, { x: valuesX + 70 - bdWidth, y, size: 12, font: boldFont, color: bdColor });
                y -= 25;

                // --- Notes ---
                if (invoice.notes) {
                    checkPageBreak(80);
                    currentPage.drawText('Notes:', { x: margin, y, size: 10, font: boldFont, color: DARK });
                    y -= 16;
                    const words = invoice.notes.split(' ');
                    let line = '';
                    for (const word of words) {
                        const testLine = line ? `${line} ${word}` : word;
                        if (font.widthOfTextAtSize(testLine, 10) > pageWidth) {
                            checkPageBreak(60);
                            currentPage.drawText(line, { x: margin, y, size: 10, font, color: GRAY });
                            y -= 14;
                            line = word;
                        } else {
                            line = testLine;
                        }
                    }
                    if (line) {
                        checkPageBreak(60);
                        currentPage.drawText(line, { x: margin, y, size: 10, font, color: GRAY });
                        y -= 20;
                    }
                }

                // --- Footer ---
                const footerText = 'Thank you for choosing K9 Vision!';
                const footerWidth = font.widthOfTextAtSize(footerText, 10);
                currentPage.drawText(footerText, { x: (612 - footerWidth) / 2, y: 30, size: 10, font, color: GRAY });

                // Download
                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `K9Vision_Invoice_${invoice.invoice_number}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                console.error('PDF generation error:', err);
                showToast('Failed to generate PDF', 'error');
            }
        }

        // PASSWORD RESET
        function closePasswordModal() {
            document.getElementById('password-change-modal').classList.add('hidden');
            document.getElementById('pw-current').value = '';
            document.getElementById('pw-new').value = '';
            document.getElementById('pw-confirm').value = '';
            document.getElementById('pw-error').classList.add('hidden');
        }

        async function submitPasswordChange() {
            const current = document.getElementById('pw-current').value;
            const newPw = document.getElementById('pw-new').value;
            const confirm = document.getElementById('pw-confirm').value;
            const errEl = document.getElementById('pw-error');

            errEl.classList.add('hidden');

            if (!current || !newPw || !confirm) {
                errEl.textContent = 'All fields are required';
                errEl.classList.remove('hidden');
                return;
            }
            if (newPw.length < 8) {
                errEl.textContent = 'New password must be at least 8 characters';
                errEl.classList.remove('hidden');
                return;
            }
            if (newPw !== confirm) {
                errEl.textContent = 'New passwords do not match';
                errEl.classList.remove('hidden');
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/auth/change-password`, {
                    method: 'POST',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ current_password: current, new_password: newPw })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Password changed successfully!', 'success');
                    closePasswordModal();
                } else {
                    errEl.textContent = data.error || 'Failed to change password';
                    errEl.classList.remove('hidden');
                }
            } catch (err) {
                errEl.textContent = 'Failed to change password';
                errEl.classList.remove('hidden');
            }
        }

        // Delete note (client can only delete own notes)
        async function deleteNote(noteId) {
            if (!confirm('Delete this message? This cannot be undone.')) return;
            try {
                const res = await fetch(`${API_BASE}/notes/${noteId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    showToast('Message deleted', 'success');
                    if (currentClientId) loadNotes(currentClientId);
                } else {
                    const data = await res.json();
                    showToast(data.error || 'Failed to delete message', 'error');
                }
            } catch (error) {
                console.error('Delete note error:', error);
                showToast('Failed to delete message', 'error');
            }
        }

        // Notification badge for unread trainer notes
        function updateUnreadBadge(notes) {
            const lastSeen = localStorage.getItem('lastSeenNoteTimestamp') || '1970-01-01T00:00:00Z';
            const trainerNotes = notes.filter(n => n.author_role === 'admin' || n.author_role !== 'client');
            const unread = trainerNotes.filter(n => new Date(n.created_at) > new Date(lastSeen)).length;
            const badge = document.getElementById('unread-badge');
            if (unread > 0) {
                badge.textContent = unread;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        function markNotesAsRead() {
            localStorage.setItem('lastSeenNoteTimestamp', new Date().toISOString());
            const badge = document.getElementById('unread-badge');
            badge.classList.add('hidden');
        }

        // Mark notes read when conversation section is scrolled into view
        const conversationEl = document.getElementById('conversation');
        const notesObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) markNotesAsRead();
            });
        }, { threshold: 0.3 });
        notesObserver.observe(conversationEl);

        // iCal Calendar Subscribe
        async function showCalendarSubscribe() {
            try {
                const res = await fetch(`${API_BASE}/calendar/feed/generate`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (res.ok && data.feed_url) {
                    const url = data.feed_url;
                    document.getElementById('ical-url').value = url;
                    const webcalUrl = url.replace(/^https?:\/\//, 'webcal://');
                    document.getElementById('ical-webcal-link').href = webcalUrl;
                    document.getElementById('calendar-subscribe-modal').classList.remove('hidden');
                } else {
                    showToast(data.error || 'Failed to generate calendar link', 'error');
                }
            } catch (error) {
                console.error('Calendar subscribe error:', error);
                showToast('Failed to generate calendar link', 'error');
            }
        }

        function copyCalendarUrl() {
            const input = document.getElementById('ical-url');
            input.select();
            navigator.clipboard.writeText(input.value).then(() => {
                showToast('Calendar URL copied!', 'success');
            }).catch(() => {
                document.execCommand('copy');
                showToast('Calendar URL copied!', 'success');
            });
        }

        loadClientData();
        loadMyAppointments();
        loadInvoices();
        loadMilestones();
