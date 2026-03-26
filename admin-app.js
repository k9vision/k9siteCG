        const API_BASE = '/api';
        let allClients = [];

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

        // Confirm Modal System
        function showConfirmModal(title, message, onConfirm, btnText = 'Delete') {
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;
            const btn = document.getElementById('confirm-yes');
            btn.textContent = btnText;
            btn.onclick = () => { closeConfirmModal(); onConfirm(); };
            document.getElementById('confirm-modal').classList.remove('hidden');
        }
        function closeConfirmModal() {
            document.getElementById('confirm-modal').classList.add('hidden');
        }

        // Client Search & Filter
        function filterClients() {
            const query = (document.getElementById('client-search').value || '').toLowerCase();
            const statusFilter = document.getElementById('client-status-filter').value;
            const cards = document.querySelectorAll('#clients-list > div');
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                const matchesSearch = !query || text.includes(query);
                const isPending = text.includes('invite pending');
                const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && !isPending);
                card.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
            });
        }

        // Day Detail View
        function showDayDetail(dateStr) {
            const modal = document.getElementById('day-detail-modal');
            const title = document.getElementById('day-detail-title');
            const content = document.getElementById('day-detail-content');
            const d = new Date(dateStr + 'T00:00:00');
            title.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            let html = '';

            // Appointments for this day
            const dayAppts = (cachedAppointments || []).filter(a => a.appointment_date === dateStr && a.status !== 'cancelled');
            html += '<h4 class="font-semibold mb-2 flex items-center gap-2"><span class="material-icons text-blue-500 text-lg">event</span>Appointments</h4>';
            if (dayAppts.length > 0) {
                html += dayAppts.map(a => {
                    const statusColors = { pending: 'bg-yellow-500', confirmed: 'bg-green-500', completed: 'bg-gray-500' };
                    return `<div class="p-3 mb-2 border border-border-dark dark:border-border-light rounded text-sm">
                        <div class="flex justify-between items-center">
                            <span class="font-semibold">${a.start_time} - ${a.end_time}</span>
                            <span class="text-xs px-2 py-0.5 rounded text-white ${statusColors[a.status] || 'bg-gray-500'}">${a.status}</span>
                        </div>
                        <p class="text-gray-400 dark:text-gray-600 mt-1">${a.client_name || 'Unknown'} (${a.dog_name || ''})</p>
                        ${a.service_name ? `<p class="text-xs text-gray-500">${a.service_name}</p>` : ''}
                    </div>`;
                }).join('');
            } else {
                html += '<p class="text-gray-500 text-sm mb-4">No appointments</p>';
            }

            // Availability for this day
            const dow = d.getDay();
            const daySlots = (cachedAvailabilitySlots || []).filter(s => {
                if (!s.is_active) return false;
                if (s.specific_date) return s.specific_date === dateStr;
                return s.day_of_week === dow && (!s.recurring_start_date || s.recurring_start_date <= dateStr) && (!s.recurring_end_date || s.recurring_end_date >= dateStr);
            });
            html += '<h4 class="font-semibold mb-2 mt-4 flex items-center gap-2"><span class="material-icons text-green-500 text-lg">schedule</span>Availability</h4>';
            if (daySlots.length > 0) {
                html += daySlots.map(s => `<div class="p-3 mb-2 border border-green-500/30 rounded text-sm bg-green-500/5">
                    <span class="font-semibold">${s.start_time} - ${s.end_time}</span>
                    <span class="text-xs text-gray-500 ml-2">(${s.slot_duration_minutes}min slots)</span>
                    <span class="text-xs ml-2 ${s.specific_date ? 'text-blue-400' : 'text-green-400'}">${s.specific_date ? 'one-time' : 'recurring'}</span>
                </div>`).join('');
            } else {
                html += '<p class="text-gray-500 text-sm mb-4">No availability</p>';
            }

            // Check if blocked
            const blocked = (cachedBlockedDates || []).find(b => b.blocked_date === dateStr);
            if (blocked) {
                html += `<div class="p-3 mt-4 border border-red-500/30 rounded text-sm bg-red-500/10">
                    <span class="material-icons text-red-500 text-lg align-middle mr-1">block</span>
                    <span class="font-semibold text-red-400">Blocked</span>
                    ${blocked.reason ? `<span class="text-gray-400 ml-2">${blocked.reason}</span>` : ''}
                </div>`;
            }

            content.innerHTML = html;
            modal.classList.remove('hidden');
        }

        function showSection(sectionId) {
            const section = document.getElementById(sectionId);
            const container = document.getElementById('sections-container');
            section.classList.remove('hidden');
            container.prepend(section);
        }

        function hideSection(sectionId) {
            document.getElementById(sectionId).classList.add('hidden');
        }

        function checkAuth() {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (!token || user.role !== 'admin') {
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

        function handleAuthError(res) {
            if (res.status === 401 || res.status === 403) {
                showToast('Session expired. Please log in again.', 'error');
                setTimeout(() => { window.location.href = '/portal.html'; }, 1500);
                return true;
            }
            return false;
        }

        async function loadDashboard() {
            if (!checkAuth()) return;
            loadStats();
        }

        async function loadStats() {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    document.getElementById('stat-clients').textContent = data.stats.totalClients;
                    document.getElementById('stat-appointments').textContent = data.stats.activeAppointmentsToday;
                    document.getElementById('stat-overdue').textContent = data.stats.overdueInvoices;
                    document.getElementById('stat-revenue').textContent = '$' + Number(data.stats.revenueThisMonth).toLocaleString('en-US', {minimumFractionDigits: 2});
                }
            } catch (e) { console.error('Failed to load stats:', e); }
        }

        async function showClients() {
            try {
                const res = await fetch(`${API_BASE}/clients`, { headers: getAuthHeaders() });
                if (handleAuthError(res)) return;
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `Server error: ${res.status}`);
                }
                const data = await res.json();
                const clients = data.clients || [];
                allClients = clients;

                const clientsList = document.getElementById('clients-list');
                if (clients.length === 0) {
                    clientsList.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No clients found</p>';
                } else {
                    clientsList.innerHTML = clients.map(client => {
                        const isPending = !client.username;
                        const statusBadge = isPending
                            ? '<span class="text-xs px-2 py-1 rounded bg-yellow-500 text-white ml-2">Invite Pending</span>'
                            : '';
                        const inviteBtn = isPending
                            ? `<button onclick="resendInvite(${client.id})" class="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700">Resend Invite</button>`
                            : '';
                        const resetBtns = !isPending
                            ? `<button onclick="sendResetEmail(${client.id})" class="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-700">Send Reset Email</button>
                               <button onclick="showManualReset(${client.id}, '${(client.client_name || '').replace(/'/g, "\\'")}')" class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Set Password</button>`
                            : '';
                        return `
                        <div class="border border-border-dark dark:border-border-light rounded p-4">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h4 class="font-bold text-lg">${client.dog_name || 'Unknown'}${statusBadge}</h4>
                                    <p class="text-gray-400 dark:text-gray-600">Client: ${client.client_name || 'N/A'}${client.username ? ` (${client.username})` : ''}</p>
                                    <p class="text-gray-400 dark:text-gray-600">Breed: ${client.dog_breed || 'N/A'}</p>
                                    <p class="text-gray-400 dark:text-gray-600">Age: ${client.dog_age || 'N/A'} years</p>
                                </div>
                                <div class="flex gap-2 flex-wrap justify-end">
                                    <button onclick="viewClient(${client.id})" class="bg-primary text-white px-4 py-1 rounded text-sm">View Details</button>
                                    ${inviteBtn}
                                    ${resetBtns}
                                    <button onclick="deleteClient(${client.user_id || client.id}, '${(client.client_name || '').replace(/'/g, "\\'")}')" class="bg-red-700 text-white px-3 py-1 rounded text-sm hover:bg-red-900">Delete Client</button>
                                </div>
                            </div>
                        </div>`;
                    }).join('');
                }

                showSection('clients-section');
            } catch (error) {
                console.error('Error loading clients:', error);
                showToast('Failed to load clients', 'error');
            }
        }

        async function deleteClient(userId, clientName) {
            showConfirmModal('Delete Client', `This will permanently delete "${clientName}" and ALL associated data including media, notes, invoices, and fun facts. This action CANNOT be undone.`, async () => {
                try {
                    const res = await fetch(`${API_BASE}/clients/${userId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (handleAuthError(res)) return;
                    const data = await res.json();
                    if (res.ok) {
                        showToast('Client deleted successfully', 'success');
                        showClients();
                    } else {
                        showToast(data.error || 'Failed to delete client', 'error');
                    }
                } catch (error) {
                    console.error('Delete client error:', error);
                    showToast('Failed to delete client', 'error');
                }
            });
        }

        async function loadClientSelects() {
            try {
                const res = await fetch(`${API_BASE}/clients`, { headers: getAuthHeaders() });
                const data = await res.json();
                const clients = data.clients || [];

                const uploadSelect = document.getElementById('upload-client-select');
                const noteSelect = document.getElementById('note-client-select');
                const funFactSelect = document.getElementById('fun-fact-client-select');

                const options = clients.map(c => `<option value="${c.id}">${c.dog_name || 'Client ' + c.id}</option>`).join('');
                uploadSelect.innerHTML = '<option value="">Choose a client...</option>' + options;
                noteSelect.innerHTML = '<option value="">Choose a client...</option>' + options;
                if (funFactSelect) {
                    funFactSelect.innerHTML = '<option value="">Choose a client...</option>' + options;
                }

                const invoiceSelect = document.getElementById('invoice-client-select');
                if (invoiceSelect) {
                    invoiceSelect.innerHTML = '<option value="">Choose a client...</option>' + options;
                }
            } catch (error) {
                console.error('Error loading clients:', error);
            }
        }

        function showUploadMedia() {
            loadClientSelects();
            document.getElementById('upload-modal').classList.remove('hidden');
        }

        function closeUploadModal() {
            document.getElementById('upload-modal').classList.add('hidden');
            document.getElementById('upload-form').reset();
        }

        function showCreateNote() {
            loadClientSelects();
            document.getElementById('note-media-select').innerHTML = '<option value="">No media reference</option>';
            document.getElementById('note-modal').classList.remove('hidden');
        }

        // Populate media dropdown when client is selected in note modal
        document.getElementById('note-client-select').addEventListener('change', async (e) => {
            const clientId = e.target.value;
            const mediaSelect = document.getElementById('note-media-select');
            mediaSelect.innerHTML = '<option value="">No media reference</option>';
            if (!clientId) return;
            try {
                const res = await fetch(`${API_BASE}/media/client/${clientId}`, { headers: getAuthHeaders() });
                const data = await res.json();
                const items = data.media || [];
                items.forEach(m => {
                    const icon = m.type === 'photo' ? '📷' : '🎥';
                    const label = m.caption || m.original_name || m.filename;
                    mediaSelect.innerHTML += `<option value="${m.id}">${icon} ${label}</option>`;
                });
            } catch (err) { console.error('Failed to load media for note:', err); }
        });

        function closeNoteModal() {
            document.getElementById('note-modal').classList.add('hidden');
            document.getElementById('note-form').reset();
        }

        function showAddFunFact() {
            loadClientSelects();
            document.getElementById('fun-fact-modal').classList.remove('hidden');
        }

        function closeFunFactModal() {
            document.getElementById('fun-fact-modal').classList.add('hidden');
            document.getElementById('fun-fact-form').reset();
        }

        // Non-client toggle functions
        function toggleUploadNonClient() {
            const isNonClient = document.getElementById('upload-nonclient-toggle').checked;
            document.getElementById('upload-client-field').classList.toggle('hidden', isNonClient);
            document.getElementById('upload-email-field').classList.toggle('hidden', !isNonClient);
            const sel = document.getElementById('upload-client-select');
            if (isNonClient) { sel.removeAttribute('required'); sel.value = ''; } else { sel.setAttribute('required', ''); }
        }

        function toggleNoteNonClient() {
            const isNonClient = document.getElementById('note-nonclient-toggle').checked;
            document.getElementById('note-client-field').classList.toggle('hidden', isNonClient);
            document.getElementById('note-email-field').classList.toggle('hidden', !isNonClient);
            const sel = document.getElementById('note-client-select');
            if (isNonClient) { sel.removeAttribute('required'); sel.value = ''; } else { sel.setAttribute('required', ''); }
        }

        function toggleFactNonClient() {
            const isNonClient = document.getElementById('fact-nonclient-toggle').checked;
            document.getElementById('fact-client-field').classList.toggle('hidden', isNonClient);
            document.getElementById('fact-email-field').classList.toggle('hidden', !isNonClient);
            const sel = document.getElementById('fun-fact-client-select');
            if (isNonClient) { sel.removeAttribute('required'); sel.value = ''; } else { sel.setAttribute('required', ''); }
        }

        document.getElementById('upload-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const isNonClient = document.getElementById('upload-nonclient-toggle').checked;
            const file = document.getElementById('media-file').files[0];
            if (!file) { showToast('Please select a file', 'error'); return; }

            if (isNonClient) {
                // Email-only mode: send email with media file attached
                const email = document.getElementById('upload-nonclient-email').value;
                if (!email) { showToast('Please enter an email address', 'error'); return; }
                const caption = document.getElementById('media-caption').value || '';
                const type = document.getElementById('media-type').value;
                showToast('Preparing file for email...', 'info');
                try {
                    // Read file as base64
                    const fileBase64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:... prefix
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    const res = await fetch(`${API_BASE}/email/send-content`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            to: email,
                            subject: `Media Shared - K9 Vision`,
                            content_type: 'media',
                            title: `New ${type} shared with you`,
                            content_body: caption || `A ${type} has been shared with you by your trainer at K9 Vision.`,
                            attachment: { filename: file.name, content: fileBase64 }
                        })
                    });
                    if (res.ok) { showToast('Media emailed with attachment!', 'success'); closeUploadModal(); }
                    else { const d = await res.json(); showToast(d.error || 'Failed to send', 'error'); }
                } catch (err) { console.error(err); showToast('Failed to send email', 'error'); }
            } else {
                // Normal client upload
                const clientId = document.getElementById('upload-client-select').value;
                if (!clientId) { showToast('Please select a client', 'error'); return; }
                const formData = new FormData();
                formData.append('file', file);
                formData.append('client_id', clientId);
                formData.append('type', document.getElementById('media-type').value);
                formData.append('caption', document.getElementById('media-caption').value || '');
                try {
                    const res = await fetch(`${API_BASE}/media/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: formData
                    });
                    if (res.ok) { showToast('Media uploaded! Client notified via email.', 'success'); closeUploadModal(); loadDashboard(); }
                    else { showToast('Upload failed', 'error'); }
                } catch (error) { console.error('Upload error:', error); showToast('Upload failed', 'error'); }
            }
        });

        document.getElementById('note-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const isNonClient = document.getElementById('note-nonclient-toggle').checked;
            const title = document.getElementById('note-title').value;
            const content = document.getElementById('note-content').value;

            if (isNonClient) {
                const email = document.getElementById('note-nonclient-email').value;
                if (!email) { showToast('Please enter an email address', 'error'); return; }
                try {
                    const res = await fetch(`${API_BASE}/email/send-content`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ to: email, subject: `Training Note: ${title}`, content_type: 'note', title, content_body: content })
                    });
                    if (res.ok) { showToast('Note emailed!', 'success'); closeNoteModal(); }
                    else { const d = await res.json(); showToast(d.error || 'Failed to send', 'error'); }
                } catch (err) { console.error(err); showToast('Failed to send email', 'error'); }
            } else {
                const clientId = document.getElementById('note-client-select').value;
                if (!clientId) { showToast('Please select a client', 'error'); return; }
                const mediaId = document.getElementById('note-media-select').value;
                const body = { client_id: clientId, title, content, author_role: 'admin' };
                if (mediaId) body.media_id = parseInt(mediaId);
                try {
                    const res = await fetch(`${API_BASE}/notes`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
                    if (res.ok) { showToast('Note created! Client notified via email.', 'success'); closeNoteModal(); loadDashboard(); }
                    else { showToast('Failed to create note', 'error'); }
                } catch (error) { console.error('Note error:', error); showToast('Failed to create note', 'error'); }
            }
        });

        document.getElementById('fun-fact-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const isNonClient = document.getElementById('fact-nonclient-toggle').checked;
            const fact = document.getElementById('fun-fact-content').value;

            if (isNonClient) {
                const email = document.getElementById('fact-nonclient-email').value;
                if (!email) { showToast('Please enter an email address', 'error'); return; }
                try {
                    const res = await fetch(`${API_BASE}/email/send-content`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ to: email, subject: 'Fun Fact - K9 Vision', content_type: 'fun_fact', title: 'Fun Fact', content_body: fact })
                    });
                    if (res.ok) { showToast('Fun fact emailed!', 'success'); closeFunFactModal(); }
                    else { const d = await res.json(); showToast(d.error || 'Failed to send', 'error'); }
                } catch (err) { console.error(err); showToast('Failed to send email', 'error'); }
            } else {
                const clientId = document.getElementById('fun-fact-client-select').value;
                if (!clientId) { showToast('Please select a client', 'error'); return; }
                try {
                    const res = await fetch(`${API_BASE}/fun-facts`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ client_id: clientId, fact }) });
                    if (res.ok) { showToast('Fun fact added! Client notified via email.', 'success'); closeFunFactModal(); }
                    else { showToast('Failed to add fun fact', 'error'); }
                } catch (error) { console.error('Fun fact error:', error); showToast('Failed to add fun fact', 'error'); }
            }
        });

        // Admin note media capture functions
        function adminNoteCapture(type) {
            const inputId = type === 'image' ? 'admin-note-photo-input' : 'admin-note-video-input';
            document.getElementById(inputId).onchange = async function() {
                await adminNoteHandleFile(this);
            };
            document.getElementById(inputId).click();
        }

        function adminNoteUpload() {
            document.getElementById('admin-note-file-input').onchange = async function() {
                await adminNoteHandleFile(this);
            };
            document.getElementById('admin-note-file-input').click();
        }

        async function adminNoteHandleFile(input) {
            const file = input.files[0];
            if (!file) return;
            const clientId = document.getElementById('note-client-select').value;
            if (!clientId) { showToast('Please select a client first', 'error'); input.value = ''; return; }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('clientId', clientId);
            formData.append('caption', '');

            try {
                showToast('Uploading media...', 'info');
                const res = await fetch(`${API_BASE}/media/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: formData
                });
                if (res.ok) {
                    const data = await res.json();
                    // Refresh media dropdown and auto-select new item
                    const mediaRes = await fetch(`${API_BASE}/media/client/${clientId}`, { headers: getAuthHeaders() });
                    const mediaData = await mediaRes.json();
                    const mediaItems = mediaData.media || mediaData || [];
                    const select = document.getElementById('note-media-select');
                    select.innerHTML = '<option value="">No media reference</option>' +
                        mediaItems.map(m => `<option value="${m.id}">${m.original_name || m.filename} (${m.type})</option>`).join('');
                    // Auto-select the newest item
                    if (data.media && data.media.id) {
                        select.value = data.media.id;
                    } else if (mediaItems.length > 0) {
                        select.value = mediaItems[mediaItems.length - 1].id;
                    }
                    showToast('Media uploaded and attached!', 'success');
                } else {
                    const errData = await res.json();
                    showToast(errData.error || 'Upload failed', 'error');
                }
            } catch (error) {
                console.error('Admin note upload error:', error);
                showToast('Upload failed', 'error');
            }
            input.value = '';
        }

        let currentDetailClientId = null;

        async function viewClient(clientId) {
            currentDetailClientId = clientId;
            const modal = document.getElementById('client-detail-modal');
            modal.classList.remove('hidden');

            // Populate client info from cached data
            const client = allClients.find(c => c.id === clientId);
            if (client) {
                document.getElementById('detail-client-id').value = clientId;
                document.getElementById('detail-user-id').value = client.user_id || '';
                document.getElementById('detail-client-name-input').value = client.client_name || '';
                document.getElementById('detail-email').value = client.email || '';
            }

            // Show loading state
            document.getElementById('detail-dogs').innerHTML = '<p class="text-gray-400 dark:text-gray-600">Loading...</p>';
            document.getElementById('detail-media').innerHTML = '<p class="text-gray-400 dark:text-gray-600 col-span-3">Loading...</p>';
            document.getElementById('detail-notes').innerHTML = '<p class="text-gray-400 dark:text-gray-600">Loading...</p>';
            document.getElementById('detail-fun-facts').innerHTML = '<p class="text-gray-400 dark:text-gray-600">Loading...</p>';
            document.getElementById('detail-milestones').innerHTML = '<p class="text-gray-400 dark:text-gray-600">Loading...</p>';
            document.getElementById('add-dog-form-admin').classList.add('hidden');
            document.getElementById('milestone-form').classList.add('hidden');

            try {
                const headers = getAuthHeaders();
                const [dogsRes, mediaRes, notesRes, factsRes, milestonesRes] = await Promise.all([
                    fetch(`${API_BASE}/dogs?client_id=${clientId}`, { headers }),
                    fetch(`${API_BASE}/media/client/${clientId}`, { headers }),
                    fetch(`${API_BASE}/notes/client/${clientId}`, { headers }),
                    fetch(`${API_BASE}/fun-facts/client/${clientId}`, { headers }),
                    fetch(`${API_BASE}/milestones?client_id=${clientId}`, { headers })
                ]);

                // Dogs
                const dogsData = await dogsRes.json();
                const dogs = dogsData.dogs || [];
                const dogsEl = document.getElementById('detail-dogs');
                if (dogs.length > 0) {
                    dogsEl.innerHTML = dogs.map(d => `
                        <div class="p-3 bg-background-dark dark:bg-gray-50 rounded flex justify-between items-start" id="dog-row-${d.id}">
                            <div class="flex items-start gap-3 flex-1">
                                <div class="relative flex-shrink-0">
                                    ${d.photo_url
                                        ? `<img src="${d.photo_url}" alt="${d.dog_name}" class="w-12 h-12 rounded-full object-cover">`
                                        : `<div class="w-12 h-12 rounded-full bg-primary flex items-center justify-center"><span class="material-icons text-white">pets</span></div>`
                                    }
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="font-semibold">${d.dog_name}</span>
                                        ${d.is_primary ? '<span class="text-xs bg-primary text-white px-2 py-0.5 rounded">Primary</span>' : ''}
                                    </div>
                                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm" id="dog-display-${d.id}">
                                        <span class="text-gray-400 dark:text-gray-600">Breed: ${d.breed || 'N/A'}</span>
                                        <span class="text-gray-400 dark:text-gray-600">Age: ${d.age || 'N/A'}</span>
                                    </div>
                                    <div class="hidden grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1" id="dog-edit-${d.id}">
                                        <input type="text" value="${d.dog_name || ''}" placeholder="Name" class="text-sm rounded border-gray-600 dark:border-gray-300 bg-card-dark dark:bg-white text-text-dark dark:text-text-light" id="dog-edit-name-${d.id}">
                                        <input type="text" value="${d.breed || ''}" placeholder="Breed" class="text-sm rounded border-gray-600 dark:border-gray-300 bg-card-dark dark:bg-white text-text-dark dark:text-text-light" id="dog-edit-breed-${d.id}">
                                        <input type="number" value="${d.age || ''}" placeholder="Age" min="0" class="text-sm rounded border-gray-600 dark:border-gray-300 bg-card-dark dark:bg-white text-text-dark dark:text-text-light" id="dog-edit-age-${d.id}">
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-1 ml-2">
                                <label class="text-primary hover:text-blue-300 text-xs cursor-pointer">
                                    Photo
                                    <input type="file" accept="image/*" class="hidden" onchange="uploadDogPhotoAdmin(${d.id}, this)">
                                </label>
                                <button onclick="toggleEditDog(${d.id})" class="text-primary hover:text-blue-300 text-xs" id="dog-edit-btn-${d.id}">Edit</button>
                                <button onclick="saveDogEdit(${d.id})" class="hidden text-green-500 hover:text-green-300 text-xs" id="dog-save-btn-${d.id}">Save</button>
                                <button onclick="deleteDog(${d.id})" class="text-red-500 hover:text-red-300 text-xs">Delete</button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    dogsEl.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No dogs yet</p>';
                }

                // Populate milestone dog dropdown with this client's dogs
                const milestoneDogSelect = document.getElementById('new-milestone-dog');
                if (milestoneDogSelect) {
                    milestoneDogSelect.innerHTML = '<option value="">General (no specific dog)</option>';
                    dogs.forEach(d => {
                        milestoneDogSelect.innerHTML += `<option value="${d.id}">${d.dog_name}</option>`;
                    });
                }

                // Media (with delete buttons and lightbox)
                const mediaData = await mediaRes.json();
                const media = mediaData.media || mediaData || [];
                window.currentDetailMedia = media;
                renderAdminMedia(media);

                // Notes (with delete buttons)
                const notesData = await notesRes.json();
                const notes = notesData.notes || notesData || [];
                const notesEl = document.getElementById('detail-notes');
                if (Array.isArray(notes) && notes.length > 0) {
                    notesEl.innerHTML = notes.map(n => {
                        const isClient = n.author_role === 'client';
                        const roleLabel = isClient ? 'Client' : 'Trainer';
                        const roleColor = isClient ? 'text-green-400' : 'text-blue-400';
                        const borderColor = isClient ? 'border-l-4 border-green-500' : 'border-l-4 border-blue-500';
                        let mediaTag = '';
                        if (n.media_items && n.media_items.length > 0) {
                            mediaTag = '<div class="flex flex-wrap gap-1 mt-1">' + n.media_items.map(m => {
                                if (m.type === 'photo') return `<img src="${m.url}" alt="${m.caption || 'Photo'}" class="w-12 h-12 object-cover rounded cursor-pointer border border-gray-600 hover:opacity-80" onclick="window.open('${m.url}', '_blank')">`;
                                return `<div class="inline-flex items-center gap-1 bg-gray-700 rounded px-2 py-1 cursor-pointer hover:bg-gray-600" onclick="window.open('${m.url}', '_blank')"><span class="material-icons text-sm">play_circle</span><span class="text-xs text-purple-400">${m.caption || 'Video'}</span></div>`;
                            }).join('') + '</div>';
                        } else if (n.media_url) {
                            mediaTag = n.media_type === 'photo'
                                ? `<img src="${n.media_url}" alt="${n.media_filename || 'Photo'}" class="w-16 h-16 object-cover rounded mt-1 cursor-pointer border border-gray-600 hover:opacity-80" onclick="window.open('${n.media_url}', '_blank')">`
                                : `<div class="mt-1 inline-flex items-center gap-1 bg-gray-700 rounded px-2 py-1 cursor-pointer hover:bg-gray-600" onclick="window.open('${n.media_url}', '_blank')"><span class="material-icons text-sm">play_circle</span><span class="text-xs text-purple-400">${'Video'}</span></div>`;
                        }
                        return `<div class="p-3 bg-background-dark dark:bg-gray-50 rounded flex justify-between items-start ${borderColor}">
                            <div class="flex-1">
                                <span class="text-xs font-bold ${roleColor}">${roleLabel}</span>
                                <p class="font-semibold text-sm">${n.title}</p>
                                <p class="text-sm text-gray-400 dark:text-gray-600">${n.content}</p>
                                ${mediaTag}
                                <p class="text-xs text-gray-500 mt-1">${n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                            </div>
                            <button onclick="deleteNote(${n.id})" class="text-red-500 hover:text-red-300 text-xs ml-2">Delete</button>
                        </div>`;
                    }).join('');
                } else {
                    notesEl.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No notes yet</p>';
                }

                // Fun Facts (with delete buttons)
                const factsData = await factsRes.json();
                const facts = factsData.fun_facts || factsData || [];
                const factsEl = document.getElementById('detail-fun-facts');
                if (Array.isArray(facts) && facts.length > 0) {
                    factsEl.innerHTML = facts.map(f =>
                        `<div class="p-3 bg-background-dark dark:bg-gray-50 rounded text-sm flex justify-between items-start">
                            <span class="flex-1">${f.fact}</span>
                            <button onclick="deleteFunFact(${f.id})" class="text-red-500 hover:text-red-300 text-xs ml-2">Delete</button>
                        </div>`
                    ).join('');
                } else {
                    factsEl.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No fun facts yet</p>';
                }

                // Training Milestones
                const milestonesData = await milestonesRes.json();
                const milestones = milestonesData.milestones || [];
                renderMilestones(milestones);

                startAdminNotesPolling();
            } catch (error) {
                console.error('Error loading client details:', error);
            }
        }

        // --- Training Milestones ---
        function toggleMilestoneForm() {
            const form = document.getElementById('milestone-form');
            form.classList.toggle('hidden');
            if (!form.classList.contains('hidden')) {
                document.getElementById('new-milestone-title').value = '';
                document.getElementById('new-milestone-desc').value = '';
                document.getElementById('new-milestone-status').value = 'not_started';
                const dogSel = document.getElementById('new-milestone-dog');
                if (dogSel) dogSel.value = '';
            }
        }

        function renderMilestones(milestones) {
            const el = document.getElementById('detail-milestones');
            if (!milestones || milestones.length === 0) {
                el.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No milestones yet</p>';
                return;
            }
            const statusConfig = {
                not_started: { label: 'Not Started', bg: 'bg-gray-500', icon: 'radio_button_unchecked' },
                in_progress: { label: 'In Progress', bg: 'bg-yellow-500', icon: 'pending' },
                completed: { label: 'Completed', bg: 'bg-green-500', icon: 'check_circle' }
            };
            // Overall progress bar
            const completed = milestones.filter(m => m.status === 'completed').length;
            const pct = Math.round((completed / milestones.length) * 100);

            // Group milestones by dog
            const groups = {};
            milestones.forEach(m => {
                const key = m.dog_name || 'General Training';
                if (!groups[key]) groups[key] = [];
                groups[key].push(m);
            });

            let html = `
                <div class="mb-3">
                    <div class="flex justify-between text-xs mb-1">
                        <span>${completed}/${milestones.length} completed</span>
                        <span>${pct}%</span>
                    </div>
                    <div class="w-full bg-gray-700 dark:bg-gray-200 rounded-full h-2">
                        <div class="bg-green-500 h-2 rounded-full transition-all" style="width:${pct}%"></div>
                    </div>
                </div>
            `;

            const groupKeys = Object.keys(groups);
            // Only show group headers if there are multiple groups or a non-General group
            const showHeaders = groupKeys.length > 1 || (groupKeys.length === 1 && groupKeys[0] !== 'General Training');

            groupKeys.forEach(groupName => {
                if (showHeaders) {
                    const groupCompleted = groups[groupName].filter(m => m.status === 'completed').length;
                    const groupPct = Math.round((groupCompleted / groups[groupName].length) * 100);
                    html += `<div class="mt-3 mb-1">
                        <div class="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                            <span class="material-icons text-sm">pets</span>
                            <span>${groupName}</span>
                            <span class="text-gray-500 dark:text-gray-400 normal-case">(${groupCompleted}/${groups[groupName].length} - ${groupPct}%)</span>
                        </div>
                    </div>`;
                }
                html += groups[groupName].map(m => {
                    const cfg = statusConfig[m.status] || statusConfig.not_started;
                    return `<div class="p-3 bg-background-dark dark:bg-gray-50 rounded text-sm flex items-start gap-3">
                        <span class="material-icons ${cfg.bg} text-white rounded-full text-base mt-0.5" style="font-size:18px">${cfg.icon}</span>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold">${m.title}</div>
                            ${m.description ? `<p class="text-gray-400 dark:text-gray-600 text-xs mt-0.5">${m.description}</p>` : ''}
                            ${m.completed_at ? `<p class="text-green-400 text-xs mt-0.5">Completed ${new Date(m.completed_at).toLocaleDateString()}</p>` : ''}
                        </div>
                        <select onchange="updateMilestoneStatus(${m.id}, this.value)" class="text-xs rounded border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light py-1 px-2">
                            <option value="not_started" ${m.status === 'not_started' ? 'selected' : ''}>Not Started</option>
                            <option value="in_progress" ${m.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${m.status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                        <button onclick="deleteMilestone(${m.id})" class="text-red-500 hover:text-red-300 text-xs flex-shrink-0">Delete</button>
                    </div>`;
                }).join('');
            });

            el.innerHTML = html;
        }

        async function createMilestone() {
            const title = document.getElementById('new-milestone-title').value.trim();
            const description = document.getElementById('new-milestone-desc').value.trim();
            const status = document.getElementById('new-milestone-status').value;
            const dog_id = document.getElementById('new-milestone-dog')?.value || null;
            if (!title) { showToast('Title is required', 'error'); return; }
            try {
                const res = await fetch(`${API_BASE}/milestones`, {
                    method: 'POST',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_id: currentDetailClientId, title, description, status, dog_id: dog_id ? parseInt(dog_id) : null })
                });
                if (res.ok) {
                    showToast('Milestone added');
                    toggleMilestoneForm();
                    await refreshMilestones();
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Failed to add milestone', 'error');
                }
            } catch (e) { showToast('Failed to add milestone', 'error'); }
        }

        async function updateMilestoneStatus(id, status) {
            try {
                const res = await fetch(`${API_BASE}/milestones/${id}`, {
                    method: 'PUT',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                });
                if (res.ok) {
                    showToast('Milestone updated');
                    await refreshMilestones();
                } else {
                    showToast('Failed to update milestone', 'error');
                }
            } catch (e) { showToast('Failed to update milestone', 'error'); }
        }

        async function deleteMilestone(id) {
            if (!confirm('Delete this milestone?')) return;
            try {
                const res = await fetch(`${API_BASE}/milestones/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    showToast('Milestone deleted');
                    await refreshMilestones();
                } else {
                    showToast('Failed to delete milestone', 'error');
                }
            } catch (e) { showToast('Failed to delete milestone', 'error'); }
        }

        async function refreshMilestones() {
            try {
                const res = await fetch(`${API_BASE}/milestones?client_id=${currentDetailClientId}`, { headers: getAuthHeaders() });
                const data = await res.json();
                renderMilestones(data.milestones || []);
            } catch (e) { console.error('Refresh milestones error:', e); }
        }

        // Notes polling for client detail view
        let adminNotesPollingInterval = null;
        let adminLastNotesHash = null;

        async function refreshClientNotes(clientId) {
            try {
                const res = await fetch(`${API_BASE}/notes/client/${clientId}`, {
                    headers: getAuthHeaders()
                });
                const notesData = await res.json();
                const notes = notesData.notes || notesData || [];
                const notesList = Array.isArray(notes) ? notes : [];
                const newHash = JSON.stringify(notesList.map(n => n.id + ':' + n.created_at + ':' + (n.updated_at || '')));
                if (adminLastNotesHash !== null && newHash === adminLastNotesHash) return;
                adminLastNotesHash = newHash;
                const notesEl = document.getElementById('detail-notes');
                if (Array.isArray(notes) && notes.length > 0) {
                    notesEl.innerHTML = notes.map(n => {
                        const isClient = n.author_role === 'client';
                        const roleLabel = isClient ? 'Client' : 'Trainer';
                        const roleColor = isClient ? 'text-green-400' : 'text-blue-400';
                        const borderColor = isClient ? 'border-l-4 border-green-500' : 'border-l-4 border-blue-500';
                        let mediaTag = '';
                        if (n.media_items && n.media_items.length > 0) {
                            mediaTag = '<div class="flex flex-wrap gap-1 mt-1">' + n.media_items.map(m => {
                                if (m.type === 'photo') return `<img src="${m.url}" alt="${m.caption || 'Photo'}" class="w-12 h-12 object-cover rounded cursor-pointer border border-gray-600 hover:opacity-80" onclick="window.open('${m.url}', '_blank')">`;
                                return `<div class="inline-flex items-center gap-1 bg-gray-700 rounded px-2 py-1 cursor-pointer hover:bg-gray-600" onclick="window.open('${m.url}', '_blank')"><span class="material-icons text-sm">play_circle</span><span class="text-xs text-purple-400">${m.caption || 'Video'}</span></div>`;
                            }).join('') + '</div>';
                        } else if (n.media_url) {
                            mediaTag = n.media_type === 'photo'
                                ? `<img src="${n.media_url}" alt="${n.media_filename || 'Photo'}" class="w-16 h-16 object-cover rounded mt-1 cursor-pointer border border-gray-600 hover:opacity-80" onclick="window.open('${n.media_url}', '_blank')">`
                                : `<div class="mt-1 inline-flex items-center gap-1 bg-gray-700 rounded px-2 py-1 cursor-pointer hover:bg-gray-600" onclick="window.open('${n.media_url}', '_blank')"><span class="material-icons text-sm">play_circle</span><span class="text-xs text-purple-400">${'Video'}</span></div>`;
                        }
                        return `<div class="p-3 bg-background-dark dark:bg-gray-50 rounded flex justify-between items-start ${borderColor}">
                            <div class="flex-1">
                                <span class="text-xs font-bold ${roleColor}">${roleLabel}</span>
                                <p class="font-semibold text-sm">${n.title}</p>
                                <p class="text-sm text-gray-400 dark:text-gray-600">${n.content}</p>
                                ${mediaTag}
                                <p class="text-xs text-gray-500 mt-1">${n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                            </div>
                            <button onclick="deleteNote(${n.id})" class="text-red-500 hover:text-red-300 text-xs ml-2">Delete</button>
                        </div>`;
                    }).join('');
                } else {
                    notesEl.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No notes yet</p>';
                }
            } catch (e) { /* silent */ }
        }

        function startAdminNotesPolling() {
            stopAdminNotesPolling();
            adminLastNotesHash = null;
            if (currentDetailClientId) {
                adminNotesPollingInterval = setInterval(() => {
                    if (currentDetailClientId) refreshClientNotes(currentDetailClientId);
                }, 10000);
            }
        }

        function stopAdminNotesPolling() {
            if (adminNotesPollingInterval) {
                clearInterval(adminNotesPollingInterval);
                adminNotesPollingInterval = null;
            }
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAdminNotesPolling();
            } else if (currentDetailClientId) {
                startAdminNotesPolling();
            }
        });

        function closeClientDetailModal() {
            document.getElementById('client-detail-modal').classList.add('hidden');
            currentDetailClientId = null;
            stopAdminNotesPolling();
        }

        // Save client email
        async function saveClientEmail() {
            const userId = document.getElementById('detail-user-id').value;
            const email = document.getElementById('detail-email').value;
            if (!userId) return;
            try {
                const res = await fetch(`${API_BASE}/clients/user/${userId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ email })
                });
                if (res.ok) {
                    showToast('Email updated!', 'success');
                    showClients();
                } else {
                    showToast('Failed to update email', 'error');
                }
            } catch (error) {
                console.error('Save email error:', error);
                showToast('Failed to update email', 'error');
            }
        }

        async function saveClientName() {
            const userId = document.getElementById('detail-user-id').value;
            const client_name = document.getElementById('detail-client-name-input').value.trim();
            if (!userId) return;
            if (!client_name) { showToast('Client name cannot be empty', 'error'); return; }
            try {
                const res = await fetch(`${API_BASE}/clients/user/${userId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ client_name })
                });
                if (res.ok) {
                    showToast('Client name updated!', 'success');
                    showClients();
                } else {
                    showToast('Failed to update client name', 'error');
                }
            } catch (error) {
                console.error('Save client name error:', error);
                showToast('Failed to update client name', 'error');
            }
        }

        // Dog management in admin detail modal
        function toggleAddDogForm() {
            document.getElementById('add-dog-form-admin').classList.toggle('hidden');
        }

        async function addDogAdmin() {
            const clientId = document.getElementById('detail-client-id').value;
            const dog_name = document.getElementById('new-dog-name').value.trim();
            const breed = document.getElementById('new-dog-breed').value.trim();
            const age = parseInt(document.getElementById('new-dog-age').value) || null;
            if (!dog_name) { showToast('Dog name is required', 'error'); return; }
            try {
                const res = await fetch(`${API_BASE}/dogs`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ client_id: parseInt(clientId), dog_name, breed, age })
                });
                if (res.ok) {
                    document.getElementById('new-dog-name').value = '';
                    document.getElementById('new-dog-breed').value = '';
                    document.getElementById('new-dog-age').value = '';
                    document.getElementById('add-dog-form-admin').classList.add('hidden');
                    await viewClient(currentDetailClientId);
                } else {
                    showToast('Failed to add dog', 'error');
                }
            } catch (error) {
                console.error('Add dog error:', error);
                showToast('Failed to add dog', 'error');
            }
        }

        function toggleEditDog(dogId) {
            document.getElementById(`dog-display-${dogId}`).classList.toggle('hidden');
            document.getElementById(`dog-edit-${dogId}`).classList.toggle('hidden');
            document.getElementById(`dog-edit-btn-${dogId}`).classList.toggle('hidden');
            document.getElementById(`dog-save-btn-${dogId}`).classList.toggle('hidden');
        }

        async function saveDogEdit(dogId) {
            const dog_name = document.getElementById(`dog-edit-name-${dogId}`).value.trim();
            const breed = document.getElementById(`dog-edit-breed-${dogId}`).value.trim();
            const age = parseInt(document.getElementById(`dog-edit-age-${dogId}`).value) || null;
            if (!dog_name) { showToast('Dog name is required', 'error'); return; }
            try {
                const res = await fetch(`${API_BASE}/dogs/${dogId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ dog_name, breed, age })
                });
                if (res.ok) {
                    await viewClient(currentDetailClientId);
                    showClients();
                } else {
                    showToast('Failed to update dog', 'error');
                }
            } catch (error) {
                console.error('Save dog error:', error);
                showToast('Failed to update dog', 'error');
            }
        }

        async function uploadDogPhotoAdmin(dogId, input) {
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
                    viewClient(currentDetailClientId);
                } else {
                    showToast(data.error || 'Failed to upload photo', 'error');
                }
            } catch (err) {
                console.error('Photo upload error:', err);
                showToast('Failed to upload photo', 'error');
            }
        }

        async function deleteDog(dogId) {
            showConfirmModal('Delete Dog', 'Are you sure you want to delete this dog?', async () => {
                try {
                    const res = await fetch(`${API_BASE}/dogs/${dogId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (res.ok) {
                        await viewClient(currentDetailClientId);
                        showClients();
                    } else {
                        showToast('Failed to delete dog', 'error');
                    }
                } catch (error) {
                    console.error('Delete dog error:', error);
                    showToast('Failed to delete dog', 'error');
                }
            });
        }

        // Delete media from detail modal
        // --- Admin Media Select/Bulk Delete ---
        let adminMediaSelectMode = false;
        let adminSelectedMediaIds = new Set();

        function renderAdminMedia(media) {
            const mediaEl = document.getElementById('detail-media');
            if (Array.isArray(media) && media.length > 0) {
                mediaEl.innerHTML = media.map((m, i) => {
                    const clickAction = adminMediaSelectMode ? `toggleAdminMediaItem(${m.id})` : `openMediaLightbox(window.currentDetailMedia[${i}])`;
                    const preview = m.type === 'photo'
                        ? `<img src="${m.url}" alt="${m.filename}" class="rounded w-full h-32 object-cover cursor-pointer" onclick="${clickAction}">`
                        : `<div class="bg-gray-700 dark:bg-gray-200 rounded flex flex-col items-center justify-center h-32 cursor-pointer" onclick="${clickAction}">
                            <span class="material-icons text-3xl text-primary">play_circle</span>
                            <span class="text-xs mt-1 px-1 truncate w-full text-center">${m.caption || (m.type === 'photo' ? 'Photo ' + (i+1) : 'Video ' + (i+1))}</span>
                          </div>`;
                    const captionHtml = m.caption ? `<p class="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate" title="${m.caption}">${m.caption}</p>` : '';
                    const deleteBtn = adminMediaSelectMode ? '' : `<button onclick="event.stopPropagation(); deleteMedia(${m.id})" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">&times;</button>`;
                    const checkbox = adminMediaSelectMode ? `<label class="absolute top-1 left-1 z-10"><input type="checkbox" ${adminSelectedMediaIds.has(m.id) ? 'checked' : ''} onchange="toggleAdminMediaItem(${m.id})" class="rounded border-gray-400 text-primary focus:ring-primary"></label>` : '';
                    const ring = adminMediaSelectMode && adminSelectedMediaIds.has(m.id) ? 'ring-2 ring-primary rounded' : '';
                    return `<div class="relative group ${ring}">${checkbox}${preview}${captionHtml}${deleteBtn}</div>`;
                }).join('');
            } else {
                mediaEl.innerHTML = '<p class="text-gray-400 dark:text-gray-600 col-span-3">No media yet</p>';
            }
        }

        function toggleAdminMediaSelect() {
            adminMediaSelectMode = !adminMediaSelectMode;
            adminSelectedMediaIds.clear();
            document.getElementById('admin-media-select-toggle').textContent = adminMediaSelectMode ? 'Cancel' : 'Select';
            document.getElementById('admin-media-select-all').classList.toggle('hidden', !adminMediaSelectMode);
            document.getElementById('admin-media-bulk-delete').classList.toggle('hidden', !adminMediaSelectMode);
            updateAdminMediaCount();
            renderAdminMedia(window.currentDetailMedia || []);
        }

        function toggleAdminMediaItem(id) {
            if (adminSelectedMediaIds.has(id)) adminSelectedMediaIds.delete(id);
            else adminSelectedMediaIds.add(id);
            updateAdminMediaCount();
            renderAdminMedia(window.currentDetailMedia || []);
        }

        function selectAllAdminMedia() {
            const media = window.currentDetailMedia || [];
            if (adminSelectedMediaIds.size === media.length) adminSelectedMediaIds.clear();
            else media.forEach(m => adminSelectedMediaIds.add(m.id));
            updateAdminMediaCount();
            renderAdminMedia(media);
        }

        function updateAdminMediaCount() {
            const el = document.getElementById('admin-media-sel-count');
            if (el) el.textContent = adminSelectedMediaIds.size;
        }

        async function bulkDeleteAdminMedia() {
            if (adminSelectedMediaIds.size === 0) { showToast('No items selected', 'error'); return; }
            showConfirmModal('Bulk Delete Media', `Delete ${adminSelectedMediaIds.size} selected item(s)?`, async () => {
                try {
                    const res = await fetch(`${API_BASE}/media/bulk-delete`, {
                        method: 'POST',
                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: [...adminSelectedMediaIds] })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        showToast(`Deleted ${data.deleted} item(s)`, 'success');
                        adminMediaSelectMode = false;
                        adminSelectedMediaIds.clear();
                        document.getElementById('admin-media-select-toggle').textContent = 'Select';
                        document.getElementById('admin-media-select-all').classList.add('hidden');
                        document.getElementById('admin-media-bulk-delete').classList.add('hidden');
                        await viewClient(currentDetailClientId);
                    } else {
                        showToast('Bulk delete failed', 'error');
                    }
                } catch (e) { showToast('Bulk delete failed', 'error'); }
            });
        }

        async function deleteMedia(mediaId) {
            showConfirmModal('Delete Media', 'Are you sure you want to delete this media file?', async () => {
                try {
                    const res = await fetch(`${API_BASE}/media/${mediaId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (res.ok) {
                        await viewClient(currentDetailClientId);
                    } else {
                        showToast('Failed to delete media', 'error');
                    }
                } catch (error) {
                    console.error('Delete media error:', error);
                    showToast('Failed to delete media', 'error');
                }
            });
        }

        // Media lightbox
        let currentLightboxMediaId = null;

        function getVideoMimeType(url) {
            if (/\.webm$/i.test(url)) return 'video/webm';
            if (/\.mov$/i.test(url)) return 'video/quicktime';
            return 'video/mp4';
        }

        function openMediaLightbox(mediaItem) {
            currentLightboxMediaId = mediaItem.id;
            const modal = document.getElementById('media-lightbox-modal');
            const content = document.getElementById('lightbox-content');
            const displayName = mediaItem.caption || (mediaItem.type === 'photo' ? 'Photo' : 'Video');
            document.getElementById('lightbox-filename').textContent = displayName;
            document.getElementById('lightbox-caption').value = mediaItem.caption || '';

            if (mediaItem.type === 'photo') {
                content.innerHTML = `<img src="${mediaItem.url}" alt="${displayName}" class="max-w-full max-h-[60vh] object-contain rounded">`;
            } else {
                const mimeType = getVideoMimeType(mediaItem.url);
                content.innerHTML = `<video controls autoplay playsinline class="max-w-full max-h-[60vh] rounded">
                    <source src="${mediaItem.url}" type="${mimeType}">
                    <p>Your browser does not support this video format. <a href="${mediaItem.url}" download class="text-primary underline">Download</a></p>
                </video>`;
            }
            modal.classList.remove('hidden');
        }

        function closeMediaLightbox(event) {
            if (event && event.target !== event.currentTarget && !event.currentTarget.id) return;
            const modal = document.getElementById('media-lightbox-modal');
            const video = modal.querySelector('video');
            if (video) video.pause();
            modal.classList.add('hidden');
            currentLightboxMediaId = null;
        }

        async function saveMediaCaption() {
            if (!currentLightboxMediaId) return;
            const caption = document.getElementById('lightbox-caption').value;
            try {
                const res = await fetch(`${API_BASE}/media/${currentLightboxMediaId}`, {
                    method: 'PUT',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ caption })
                });
                if (res.ok) {
                    showToast('Caption saved!', 'success');
                    await viewClient(currentDetailClientId);
                } else {
                    showToast('Failed to save caption', 'error');
                }
            } catch (error) {
                console.error('Save caption error:', error);
                showToast('Failed to save caption', 'error');
            }
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('media-lightbox-modal');
                if (!modal.classList.contains('hidden')) {
                    closeMediaLightbox();
                }
            }
        });

        // Delete note from detail modal
        async function deleteNote(noteId) {
            showConfirmModal('Delete Note', 'Are you sure you want to delete this note?', async () => {
                try {
                    const res = await fetch(`${API_BASE}/notes/${noteId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (res.ok) {
                        await viewClient(currentDetailClientId);
                    } else {
                        showToast('Failed to delete note', 'error');
                    }
                } catch (error) {
                    console.error('Delete note error:', error);
                    showToast('Failed to delete note', 'error');
                }
            });
        }

        // Delete fun fact from detail modal
        async function deleteFunFact(factId) {
            showConfirmModal('Delete Fun Fact', 'Are you sure you want to delete this fun fact?', async () => {
                try {
                    const res = await fetch(`${API_BASE}/fun-facts/${factId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (res.ok) {
                        await viewClient(currentDetailClientId);
                    } else {
                        showToast('Failed to delete fun fact', 'error');
                    }
                } catch (error) {
                    console.error('Delete fun fact error:', error);
                    showToast('Failed to delete fun fact', 'error');
                }
            });
        }

        // CREATE CLIENT FUNCTIONS
        function showCreateClient() {
            document.getElementById('create-client-modal').classList.remove('hidden');
            document.getElementById('credentials-display').classList.add('hidden');
            document.getElementById('invite-success-display').classList.add('hidden');
            document.getElementById('invoice-date').valueAsDate = new Date();
            toggleSetupMethod();
        }

        function closeCreateClientModal() {
            document.getElementById('create-client-modal').classList.add('hidden');
            document.getElementById('create-client-form').reset();
            document.getElementById('credentials-display').classList.add('hidden');
            document.getElementById('invite-success-display').classList.add('hidden');
        }

        function toggleSetupMethod() {
            const method = document.querySelector('input[name="setup-method"]:checked').value;
            const credentialsSection = document.getElementById('credentials-section');
            const emailCredentialsSection = document.getElementById('email-credentials-section');
            const usernameField = document.getElementById('username-field');
            const passwordInput = document.getElementById('client-password');
            const submitBtn = document.getElementById('create-client-btn');

            if (method === 'invite') {
                credentialsSection.classList.add('hidden');
                emailCredentialsSection.classList.add('hidden');
                usernameField.classList.add('hidden');
                passwordInput.required = false;
                submitBtn.textContent = 'Send Invite';
            } else {
                credentialsSection.classList.remove('hidden');
                emailCredentialsSection.classList.remove('hidden');
                usernameField.classList.remove('hidden');
                togglePasswordField();
                submitBtn.textContent = 'Create Client';
            }
        }

        function togglePasswordField() {
            const autoGen = document.getElementById('auto-generate-password').checked;
            const passwordField = document.getElementById('manual-password-field');
            const passwordInput = document.getElementById('client-password');

            if (autoGen) {
                passwordField.classList.add('hidden');
                passwordInput.required = false;
            } else {
                passwordField.classList.remove('hidden');
                passwordInput.required = true;
            }
        }

        document.getElementById('create-client-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const method = document.querySelector('input[name="setup-method"]:checked').value;
            const clientName = document.getElementById('client-name').value;
            const email = document.getElementById('client-email').value;
            const dogName = document.getElementById('client-dog-name').value;
            const breed = document.getElementById('client-dog-breed').value;
            const age = document.getElementById('client-dog-age').value;

            if (method === 'invite') {
                // Send invite flow
                try {
                    const res = await fetch(`${API_BASE}/clients/invite`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            client_name: clientName,
                            email,
                            dog_name: dogName,
                            breed: breed || null,
                            age: age ? parseInt(age) : null
                        })
                    });

                    const data = await res.json();

                    if (res.ok) {
                        document.getElementById('invite-success-display').classList.remove('hidden');
                        loadDashboard();
                        showToast('Invite sent successfully!', 'success');
                        setTimeout(() => { closeCreateClientModal(); }, 3000);
                    } else {
                        showToast(data.error || 'Failed to send invite', 'error');
                    }
                } catch (error) {
                    console.error('Invite error:', error);
                    showToast('Failed to send invite', 'error');
                }
            } else {
                // Existing credentials flow
                const username = document.getElementById('client-username').value;
                const password = document.getElementById('client-password').value;
                const autoGenPassword = document.getElementById('auto-generate-password').checked;
                const sendEmail = document.getElementById('send-credentials-email').checked;

                try {
                    const res = await fetch(`${API_BASE}/clients/create-with-email`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            client_name: clientName,
                            email,
                            dog_name: dogName,
                            breed: breed || null,
                            age: age ? parseInt(age) : null,
                            username: username || null,
                            password: autoGenPassword ? null : password,
                            auto_generate_password: autoGenPassword,
                            send_email: sendEmail
                        })
                    });

                    const data = await res.json();

                    if (res.ok) {
                        document.getElementById('display-username').textContent = data.credentials.username;
                        document.getElementById('display-password').textContent = data.credentials.password;
                        document.getElementById('credentials-display').classList.remove('hidden');

                        showToast(`Client created successfully!${sendEmail ? ' Email sent.' : ''}`, 'success');
                        loadDashboard();

                        setTimeout(() => { closeCreateClientModal(); }, 3000);
                    } else {
                        showToast(data.error || 'Failed to create client', 'error');
                    }
                } catch (error) {
                    console.error('Create client error:', error);
                    showToast('Failed to create client', 'error');
                }
            }
        });

        // PASSWORD RESET FUNCTIONS
        async function sendResetEmail(clientId) {
            showConfirmModal('Send Reset Email', 'Send a password reset email to this client?', async () => {
                try {
                    const res = await fetch(`${API_BASE}/clients/reset-password`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ client_id: clientId, mode: 'email' })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showToast('Reset email sent successfully!', 'success');
                    } else {
                        showToast(data.error || 'Failed to send reset email', 'error');
                    }
                } catch (error) {
                    console.error('Reset email error:', error);
                    showToast('Failed to send reset email', 'error');
                }
            }, 'Send');
        }

        function showManualReset(clientId, clientName) {
            document.getElementById('reset-client-id').value = clientId;
            document.getElementById('reset-client-name').textContent = clientName;
            document.getElementById('reset-new-password').value = '';
            document.getElementById('manual-reset-modal').classList.remove('hidden');
        }

        function closeManualResetModal() {
            document.getElementById('manual-reset-modal').classList.add('hidden');
            document.getElementById('manual-reset-form').reset();
        }

        document.getElementById('manual-reset-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientId = document.getElementById('reset-client-id').value;
            const newPassword = document.getElementById('reset-new-password').value;

            if (newPassword.length < 8) {
                showToast('Password must be at least 8 characters', 'error');
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/clients/reset-password`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ client_id: parseInt(clientId), mode: 'manual', new_password: newPassword })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Password updated successfully!', 'success');
                    closeManualResetModal();
                } else {
                    showToast(data.error || 'Failed to update password', 'error');
                }
            } catch (error) {
                console.error('Manual reset error:', error);
                showToast('Failed to update password', 'error');
            }
        });

        // RESEND INVITE
        async function resendInvite(clientId) {
            showConfirmModal('Resend Invite', 'Resend the invite email to this client?', async () => {
                try {
                    const clientsRes = await fetch(`${API_BASE}/clients`, { headers: getAuthHeaders() });
                    const clientsData = await clientsRes.json();
                    const client = (clientsData.clients || []).find(c => c.id === clientId);
                    if (!client) { showToast('Client not found', 'error'); return; }

                    const res = await fetch(`${API_BASE}/clients/invite`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            client_name: client.client_name,
                            email: client.email,
                            dog_name: client.dog_name,
                            breed: client.breed || client.dog_breed || null,
                            age: client.age || client.dog_age || null,
                            resend_for_client_id: clientId
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showToast('Invite resent successfully!', 'success');
                    } else {
                        showToast(data.error || 'Failed to resend invite', 'error');
                    }
                } catch (error) {
                    console.error('Resend invite error:', error);
                    showToast('Failed to resend invite', 'error');
                }
            }, 'Resend');
        }

        // SERVICES MANAGEMENT FUNCTIONS
        let servicesData = [];

        async function showServices() {
            await loadServices();
            showSection('services-section');
        }

        async function loadServices() {
            try {
                const res = await fetch(`${API_BASE}/services`);
                const data = await res.json();
                servicesData = data.services || [];

                const servicesList = document.getElementById('services-list');
                if (servicesData.length === 0) {
                    servicesList.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No services found</p>';
                } else {
                    servicesList.innerHTML = servicesData.map(service => `
                        <div class="border border-border-dark dark:border-border-light rounded p-4 flex justify-between items-center">
                            <div>
                                <h4 class="font-bold text-lg">${service.name}</h4>
                                <p class="text-gray-400 dark:text-gray-600 text-sm">${service.description || 'No description'}</p>
                                <p class="text-primary font-semibold mt-1">$${service.price.toFixed(2)}</p>
                                <span class="text-xs ${service.active ? 'text-green-500' : 'text-red-500'}">${service.active ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="editService(${service.id})" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Edit</button>
                                <button onclick="deleteService(${service.id})" class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Delete</button>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Error loading services:', error);
            }
        }

        function showAddService() {
            document.getElementById('service-modal-title').textContent = 'Add Service';
            document.getElementById('service-form').reset();
            document.getElementById('service-id').value = '';
            document.getElementById('service-modal').classList.remove('hidden');
        }

        function editService(serviceId) {
            const service = servicesData.find(s => s.id === serviceId);
            if (!service) return;

            document.getElementById('service-modal-title').textContent = 'Edit Service';
            document.getElementById('service-id').value = service.id;
            document.getElementById('service-name').value = service.name;
            document.getElementById('service-description').value = service.description || '';
            document.getElementById('service-price').value = service.price;
            document.getElementById('service-sessions').value = service.sessions || 1;
            document.getElementById('service-active').checked = service.active == 1;
            document.getElementById('service-modal').classList.remove('hidden');
        }

        function closeServiceModal() {
            document.getElementById('service-modal').classList.add('hidden');
        }

        async function deleteService(serviceId) {
            showConfirmModal('Delete Service', 'Are you sure you want to delete this service?', async () => {
                try {
                    const res = await fetch(`${API_BASE}/services/${serviceId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });

                    if (res.ok) {
                        showToast('Service deleted', 'success');
                        loadServices();
                    } else {
                        showToast('Failed to delete service', 'error');
                    }
                } catch (error) {
                    console.error('Delete service error:', error);
                    showToast('Failed to delete service', 'error');
                }
            });
        }

        document.getElementById('service-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const serviceId = document.getElementById('service-id').value;
            const name = document.getElementById('service-name').value;
            const description = document.getElementById('service-description').value;
            const price = parseFloat(document.getElementById('service-price').value);
            const sessions = parseInt(document.getElementById('service-sessions').value) || 1;
            const active = document.getElementById('service-active').checked ? 1 : 0;

            const url = serviceId ? `${API_BASE}/services/${serviceId}` : `${API_BASE}/services`;
            const method = serviceId ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name, description, price, sessions, active })
                });

                if (res.ok) {
                    showToast(`Service ${serviceId ? 'updated' : 'created'} successfully`, 'success');
                    closeServiceModal();
                    loadServices();
                } else {
                    showToast('Failed to save service', 'error');
                }
            } catch (error) {
                console.error('Service save error:', error);
                showToast('Failed to save service', 'error');
            }
        });

        // INVOICES FUNCTIONS
        let invoicesData = [];
        let invoiceItemCounter = 0;

        async function showInvoices() {
            await loadInvoices();
            showSection('invoices-section');
        }

        async function loadInvoices() {
            try {
                const res = await fetch(`${API_BASE}/invoices`, { headers: getAuthHeaders() });
                const data = await res.json();
                invoicesData = data.invoices || [];

                const invoicesList = document.getElementById('invoices-list');
                if (invoicesData.length === 0) {
                    invoicesList.innerHTML = '<p class="text-gray-400 dark:text-gray-600">No invoices found</p>';
                } else {
                    invoicesList.innerHTML = invoicesData.map(inv => `
                        <div class="border border-border-dark dark:border-border-light rounded p-4">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h4 class="font-bold text-lg">Invoice #${inv.invoice_number}</h4>
                                    <p class="text-gray-400 dark:text-gray-600">Client: ${inv.client_name} (${inv.dog_name})</p>
                                    <p class="text-gray-400 dark:text-gray-600">Date: ${new Date(inv.date).toLocaleDateString()}</p>
                                    <p class="text-primary font-bold mt-2">Total: $${Number(inv.total).toFixed(2)}</p>
                                    <p class="text-sm mt-1 ${(Number(inv.total) - Number(inv.total_paid || 0)) <= 0 ? 'text-green-400' : 'text-red-400'} font-semibold">Balance Due: $${(Number(inv.total) - Number(inv.total_paid || 0)).toFixed(2)}</p>
                                    <span class="mt-1 inline-block text-xs px-2 py-1 rounded ${inv.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'} text-white">${inv.status.toUpperCase()}</span>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="emailInvoice(${inv.id})" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">📧 Email</button>
                                    <button onclick="previewInvoiceEmail(${inv.id})" class="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500">Preview</button>
                                    <button onclick="viewInvoiceDetails(${inv.id})" class="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-blue-700">View</button>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Error loading invoices:', error);
            }
        }

        async function emailInvoice(invoiceId) {
            // Load invoice data for preview
            try {
                const res = await fetch(`${API_BASE}/invoices/${invoiceId}`, { headers: getAuthHeaders() });
                if (!res.ok) { showToast('Failed to load invoice details', 'error'); return; }
                const data = await res.json();
                const inv = data.invoice;

                // Build preview content
                const previewContent = document.getElementById('invoice-preview-content');
                previewContent.innerHTML = `
                    <div class="border border-border-dark dark:border-border-light rounded p-4 mb-4">
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p class="text-sm text-gray-400">Invoice #</p>
                                <p class="font-bold">${inv.invoice_number}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-400">Client</p>
                                <p class="font-bold">${inv.client_name || 'N/A'}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-400">Date</p>
                                <p>${inv.date ? new Date(inv.date + 'T00:00:00').toLocaleDateString() : 'N/A'}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-400">Due Date</p>
                                <p>${inv.due_date ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>
                        <div class="overflow-x-auto">
                        <table class="w-full text-sm mb-4">
                            <thead><tr class="border-b border-border-dark dark:border-border-light">
                                <th class="text-left py-2">Service</th><th class="text-right py-2">Qty</th><th class="text-right py-2">Price</th><th class="text-right py-2">Total</th><th class="text-center py-2">Due Date</th><th class="text-center py-2">Upfront</th><th class="text-right py-2">Paid</th><th class="text-right py-2">Balance</th>
                            </tr></thead>
                            <tbody>${(inv.items || []).map(item => {
                                const iPaid = Number(item.amount_paid || 0);
                                const iTotal = Number(item.total);
                                const iBal = iTotal - iPaid;
                                const iDue = item.due_date ? new Date(item.due_date + 'T00:00:00').toLocaleDateString() : '—';
                                const iUp = Number(item.upfront_pct || 0);
                                const balColor = iBal <= 0 ? 'color: #4ade80' : 'color: #facc15';
                                return `<tr class="border-b border-border-dark dark:border-border-light">
                                <td class="py-2">${item.service_name}</td><td class="text-right py-2">${item.quantity}</td><td class="text-right py-2">$${Number(item.price).toFixed(2)}</td><td class="text-right py-2">$${iTotal.toFixed(2)}</td><td class="text-center py-2 text-xs">${iDue}</td><td class="text-center py-2">${iUp}%</td><td class="text-right py-2">$${iPaid.toFixed(2)}</td><td class="text-right py-2" style="${balColor}">$${iBal.toFixed(2)}</td>
                            </tr>`;}).join('')}</tbody>
                        </table>
                        </div>
                        <div class="text-right space-y-1">
                            <p>Subtotal: <strong>$${Number(inv.subtotal).toFixed(2)}</strong></p>
                            <p>Tax (${Number(inv.tax_rate).toFixed(2)}%): <strong>$${Number(inv.tax_amount).toFixed(2)}</strong></p>
                            <p class="text-xl font-bold">Total: $${Number(inv.total).toFixed(2)}</p>
                            ${(() => { const tp = (inv.items || []).reduce((s, i) => s + Number(i.amount_paid || 0), 0); const bd = Number(inv.total) - tp; return `<p style="color: #4ade80">Total Paid: <strong>$${tp.toFixed(2)}</strong></p><p class="font-bold" style="color: ${bd <= 0 ? '#4ade80' : '#f87171'}">Balance Due: $${bd.toFixed(2)}</p>`; })()}
                        </div>
                    </div>
                    <p class="text-sm text-gray-400">This invoice will be sent to the client's email address.</p>
                `;

                // Wire up the send button
                document.getElementById('invoice-preview-send').onclick = async () => {
                    document.getElementById('invoice-preview-modal').classList.add('hidden');
                    try {
                        const sendRes = await fetch(`${API_BASE}/invoices/${invoiceId}/email`, {
                            method: 'POST',
                            headers: getAuthHeaders()
                        });
                        if (sendRes.ok) {
                            showToast('Invoice sent successfully!', 'success');
                        } else {
                            const sendData = await sendRes.json();
                            showToast(sendData.error || 'Failed to send invoice', 'error');
                        }
                    } catch (sendError) {
                        console.error('Email invoice error:', sendError);
                        showToast('Failed to send invoice', 'error');
                    }
                };

                document.getElementById('invoice-preview-modal').classList.remove('hidden');
            } catch (error) {
                console.error('Email invoice error:', error);
                showToast('Failed to send invoice', 'error');
            }
        }

        let currentDetailInvoiceId = null;
        let currentDetailItems = [];

        async function viewInvoiceDetails(invoiceId) {
            currentDetailInvoiceId = invoiceId;
            try {
                const res = await fetch(`${API_BASE}/invoices/${invoiceId}`, { headers: getAuthHeaders() });
                const data = await res.json();

                if (!res.ok) {
                    showToast('Failed to load invoice details', 'error');
                    return;
                }

                const inv = data.invoice;

                // Populate header
                document.getElementById('detail-invoice-title').textContent = `Invoice #${inv.invoice_number}`;
                document.getElementById('detail-client-name').textContent = inv.client_name || '';
                document.getElementById('detail-dog-name').textContent = inv.dog_name ? `Dog: ${inv.dog_name}` : '';
                document.getElementById('detail-trainer-name').value = inv.trainer_name || '';
                document.getElementById('detail-invoice-date').value = inv.date || '';
                document.getElementById('detail-due-date').value = inv.due_date || '';
                document.getElementById('detail-tax-rate-input').value = Number(inv.tax_rate || 0);
                document.getElementById('detail-discount-type').value = inv.discount_type || '';
                document.getElementById('detail-discount-value').value = Number(inv.discount_value || 0);

                // Status
                document.getElementById('detail-status').value = inv.status || 'pending';

                // Line items with inline editing
                const tbody = document.getElementById('detail-items-body');
                currentDetailItems = inv.items || [];
                tbody.innerHTML = (inv.items || []).map(item => {
                    const itemStatus = item.status || 'pending';
                    const statusColor = itemStatus === 'paid' ? 'bg-green-500' : 'bg-yellow-500';
                    const statusLabel = itemStatus === 'paid' ? 'Paid' : 'Pending';
                    const itemTotal = Number(item.total);
                    const amountPaid = Number(item.amount_paid || 0);
                    const balance = itemTotal - amountPaid;
                    const balanceColor = balance <= 0 ? 'text-green-400' : 'text-yellow-400';
                    const dueDateVal = item.due_date || '';
                    const upfrontPct = Number(item.upfront_pct || 0);
                    return `
                    <tr class="border-b border-border-dark dark:border-border-light" data-detail-item-id="${item.id}">
                        <td class="py-2 text-xs">${item.service_name}</td>
                        <td class="py-2"><input type="number" class="detail-item-qty w-14 text-xs text-right rounded border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" value="${item.quantity}" min="1"></td>
                        <td class="py-2"><input type="number" step="0.01" class="detail-item-price w-20 text-xs text-right rounded border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" value="${Number(item.price).toFixed(2)}"></td>
                        <td class="text-right py-2 text-xs">$${itemTotal.toFixed(2)}</td>
                        <td class="py-2"><div class="flex items-center gap-1"><input type="date" class="detail-item-due-date w-28 sm:w-32 text-xs rounded border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light min-h-[44px]" value="${dueDateVal}"><button type="button" onclick="this.previousElementSibling.value=''" class="text-gray-400 hover:text-red-400 p-0.5 flex-shrink-0" title="Clear"><span class="material-icons text-xs">close</span></button></div></td>
                        <td class="py-2">
                            <select class="detail-item-upfront w-20 text-xs rounded border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" onchange="applyUpfrontPct(this, ${item.id})">
                                <option value="0" ${upfrontPct === 0 ? 'selected' : ''}>0%</option>
                                <option value="25" ${upfrontPct === 25 ? 'selected' : ''}>25%</option>
                                <option value="50" ${upfrontPct === 50 ? 'selected' : ''}>50%</option>
                                <option value="75" ${upfrontPct === 75 ? 'selected' : ''}>75%</option>
                                <option value="100" ${upfrontPct === 100 ? 'selected' : ''}>100%</option>
                            </select>
                        </td>
                        <td class="py-2"><input type="number" step="0.01" min="0" class="detail-item-paid w-20 text-xs text-right rounded border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" value="${amountPaid.toFixed(2)}"></td>
                        <td class="text-right py-2 text-xs ${balanceColor}">$${balance.toFixed(2)}</td>
                        <td class="text-center py-2">
                            <button onclick="toggleItemStatus(${item.id}, '${itemStatus}', ${inv.id})" class="text-xs px-2 py-0.5 rounded text-white ${statusColor} hover:opacity-80 cursor-pointer" title="Click to toggle">${statusLabel}</button>
                        </td>
                        <td class="text-right py-2 space-x-1 whitespace-nowrap">
                            <button onclick="saveItemEdits(${item.id}, ${inv.id})" class="text-green-400 hover:text-green-300 text-xs" title="Save">Save</button>
                            ${amountPaid > 0 ? `<button onclick="transferCredit(${item.id}, ${inv.id})" class="text-cyan-400 hover:text-cyan-300 text-xs" title="Transfer credit">Xfer</button>` : ''}
                            <button onclick="deleteInvoiceItem(${item.id})" class="text-red-500 hover:text-red-700 text-xs" title="Delete">Del</button>
                        </td>
                    </tr>`;
                }).join('');

                // Check if all items are paid - show suggestion
                const allPaid = (inv.items || []).length > 0 && (inv.items || []).every(i => i.status === 'paid');
                if (allPaid && inv.status !== 'paid') {
                    showToast('All services are paid! Consider marking the invoice as "Paid".', 'info');
                }

                // Totals
                document.getElementById('detail-subtotal').textContent = `$${Number(inv.subtotal).toFixed(2)}`;
                const detailDiscountRow = document.getElementById('detail-discount-row');
                if (inv.discount_amount && inv.discount_amount > 0) {
                    detailDiscountRow.classList.remove('hidden');
                    document.getElementById('detail-discount-label').textContent = inv.discount_type === 'percentage' ? `Discount (${inv.discount_value}%):` : 'Discount:';
                    document.getElementById('detail-discount-display').textContent = `-$${Number(inv.discount_amount).toFixed(2)}`;
                } else {
                    detailDiscountRow.classList.add('hidden');
                }
                document.getElementById('detail-tax-rate').textContent = Number(inv.tax_rate).toFixed(2);
                document.getElementById('detail-tax').textContent = `$${Number(inv.tax_amount).toFixed(2)}`;
                document.getElementById('detail-total').textContent = `$${Number(inv.total).toFixed(2)}`;

                // Payment totals
                const totalPaid = (inv.items || []).reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
                const balanceDue = Number(inv.total) - totalPaid;
                document.getElementById('detail-total-paid').textContent = `$${totalPaid.toFixed(2)}`;
                const balanceDueEl = document.getElementById('detail-balance-due');
                balanceDueEl.textContent = `$${balanceDue.toFixed(2)}`;
                balanceDueEl.className = balanceDue <= 0 ? 'text-green-400' : 'text-red-400';

                // Notes
                document.getElementById('detail-notes').value = inv.notes || '';

                // Populate service dropdown for adding items
                await loadServices();
                const serviceSelect = document.getElementById('detail-new-service');
                serviceSelect.innerHTML = '<option value="">Select service...</option>' +
                    servicesData.map(s => `<option value="${s.id}" data-price="${s.price}" data-name="${s.name}" data-sessions="${s.sessions || 1}">${s.name} ($${s.price})${(s.sessions || 1) > 1 ? ' [' + s.sessions + ' wks]' : ''}</option>`).join('');

                document.getElementById('invoice-detail-modal').classList.remove('hidden');
            } catch (error) {
                console.error('Invoice details error:', error);
                showToast('Failed to load invoice details', 'error');
            }
        }

        function closeInvoiceDetailModal() {
            document.getElementById('invoice-detail-modal').classList.add('hidden');
            currentDetailInvoiceId = null;
        }

        function updateDetailNewItemPrice() {
            const select = document.getElementById('detail-new-service');
            const opt = select.options[select.selectedIndex];
            if (opt && opt.dataset.price) {
                document.getElementById('detail-new-price').value = opt.dataset.price;
            }
        }

        async function saveInvoiceStatus() {
            if (!currentDetailInvoiceId) return;
            const status = document.getElementById('detail-status').value;
            try {
                const res = await fetch(`${API_BASE}/invoices/${currentDetailInvoiceId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status })
                });
                if (res.ok) {
                    showToast('Status updated!', 'success');
                    loadInvoices();
                } else {
                    showToast('Failed to update status', 'error');
                }
            } catch (error) {
                console.error('Save status error:', error);
                showToast('Failed to update status', 'error');
            }
        }

        async function saveInvoiceNotes() {
            if (!currentDetailInvoiceId) return;
            const notes = document.getElementById('detail-notes').value;
            try {
                const res = await fetch(`${API_BASE}/invoices/${currentDetailInvoiceId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ notes })
                });
                if (res.ok) {
                    showToast('Notes saved!', 'success');
                } else {
                    showToast('Failed to save notes', 'error');
                }
            } catch (error) {
                console.error('Save notes error:', error);
                showToast('Failed to save notes', 'error');
            }
        }

        async function saveInvoiceDetails() {
            if (!currentDetailInvoiceId) return;
            const trainer_name = document.getElementById('detail-trainer-name').value;
            const date = document.getElementById('detail-invoice-date').value;
            const due_date = document.getElementById('detail-due-date').value;
            const tax_rate = parseFloat(document.getElementById('detail-tax-rate-input').value) || 0;
            const discount_type = document.getElementById('detail-discount-type').value || null;
            const discount_value = parseFloat(document.getElementById('detail-discount-value').value) || 0;
            try {
                const res = await fetch(`${API_BASE}/invoices/${currentDetailInvoiceId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ trainer_name, date, due_date, tax_rate, discount_type, discount_value })
                });
                if (res.ok) {
                    showToast('Invoice details saved!', 'success');
                    await viewInvoiceDetails(currentDetailInvoiceId);
                    loadInvoices();
                } else {
                    showToast('Failed to save invoice details', 'error');
                }
            } catch (error) {
                console.error('Save details error:', error);
                showToast('Failed to save invoice details', 'error');
            }
        }

        async function deleteInvoice() {
            if (!currentDetailInvoiceId) return;
            showConfirmModal('Delete Invoice', 'Are you sure you want to delete this invoice? This cannot be undone.', async () => {
                try {
                    const res = await fetch(`${API_BASE}/invoices/${currentDetailInvoiceId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (res.ok) {
                        showToast('Invoice deleted!', 'success');
                        closeInvoiceDetailModal();
                        loadInvoices();
                    } else {
                        showToast('Failed to delete invoice', 'error');
                    }
                } catch (error) {
                    console.error('Delete invoice error:', error);
                    showToast('Failed to delete invoice', 'error');
                }
            });
        }

        async function addDetailInvoiceItem() {
            if (!currentDetailInvoiceId) return;
            const serviceSelect = document.getElementById('detail-new-service');
            const opt = serviceSelect.options[serviceSelect.selectedIndex];
            const serviceId = serviceSelect.value;
            const serviceName = opt ? opt.dataset.name : '';
            const sessions = parseInt(opt?.dataset?.sessions) || 1;
            const quantity = parseInt(document.getElementById('detail-new-qty').value) || 0;
            const price = parseFloat(document.getElementById('detail-new-price').value) || 0;
            const dueDate = document.getElementById('detail-new-due-date').value || null;
            const amountPaid = parseFloat(document.getElementById('detail-new-amount-paid').value) || 0;
            const upfrontPct = parseInt(document.getElementById('detail-new-upfront-pct').value) || 0;

            if (!serviceId || !quantity || !price) {
                showToast('Please select a service and enter quantity/price', 'error');
                return;
            }

            // Build items array — auto-split if multi-session
            let newItems = [];
            if (sessions > 1) {
                const perSessionPrice = Math.round((price / sessions) * 100) / 100;
                for (let i = 0; i < sessions; i++) {
                    let weekDueDate = null;
                    if (dueDate) {
                        const d = new Date(dueDate + 'T00:00:00');
                        d.setDate(d.getDate() + (i * 7));
                        weekDueDate = d.toISOString().split('T')[0];
                    }
                    const weekPaid = upfrontPct > 0 ? Math.round((perSessionPrice * upfrontPct / 100) * 100) / 100 : 0;
                    newItems.push({
                        service_id: serviceId,
                        service_name: `${serviceName} - Week ${i + 1}`,
                        quantity: 1,
                        price: perSessionPrice,
                        due_date: weekDueDate,
                        amount_paid: weekPaid,
                        upfront_pct: upfrontPct
                    });
                }
            } else {
                newItems.push({ service_id: serviceId, service_name: serviceName, quantity, price, due_date: dueDate, amount_paid: amountPaid, upfront_pct: upfrontPct });
            }

            try {
                const res = await fetch(`${API_BASE}/invoices/${currentDetailInvoiceId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ new_items: newItems })
                });

                if (res.ok) {
                    serviceSelect.value = '';
                    document.getElementById('detail-new-qty').value = '1';
                    document.getElementById('detail-new-price').value = '';
                    document.getElementById('detail-new-due-date').value = '';
                    document.getElementById('detail-new-amount-paid').value = '0';
                    document.getElementById('detail-new-upfront-pct').value = '0';
                    await viewInvoiceDetails(currentDetailInvoiceId);
                    loadInvoices();
                    if (sessions > 1) showToast(`Added ${sessions} weekly sessions`, 'success');
                } else {
                    showToast('Failed to add item', 'error');
                }
            } catch (error) {
                console.error('Add item error:', error);
                showToast('Failed to add item', 'error');
            }
        }

        async function deleteInvoiceItem(itemId) {
            showConfirmModal('Delete Line Item', 'Are you sure you want to delete this line item?', async () => {
                try {
                    const res = await fetch(`${API_BASE}/invoices/items/${itemId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });

                    if (res.ok) {
                        await viewInvoiceDetails(currentDetailInvoiceId);
                        loadInvoices();
                    } else {
                        showToast('Failed to delete item', 'error');
                    }
                } catch (error) {
                    console.error('Delete item error:', error);
                    showToast('Failed to delete item', 'error');
                }
            });
        }

        async function toggleItemStatus(itemId, currentStatus, invoiceId) {
            const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
            if (!confirm(`Change this service from "${currentStatus}" to "${newStatus}"?\n\nClick Cancel to keep as is.`)) return;
            const notifyClient = confirm('Notify the client via email about this change?\n\nOK = Send email\nCancel = Skip email');

            try {
                const res = await fetch(`${API_BASE}/invoices/items/${itemId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: newStatus, notify_client: notifyClient })
                });
                if (res.ok) {
                    await viewInvoiceDetails(invoiceId);
                    showToast(`Service marked as ${newStatus}${notifyClient ? ' - client notified' : ''}`, 'success');
                } else {
                    const data = await res.json();
                    showToast(data.error || 'Failed to update item status', 'error');
                }
            } catch (error) {
                console.error('Toggle item status error:', error);
                showToast('Failed to update item status', 'error');
            }
        }

        // Auto-calculate amount_paid when upfront % changes
        function applyUpfrontPct(selectEl, itemId) {
            const row = selectEl.closest('tr');
            const qty = parseInt(row.querySelector('.detail-item-qty').value) || 1;
            const price = parseFloat(row.querySelector('.detail-item-price').value) || 0;
            const pct = parseInt(selectEl.value) || 0;
            const paidInput = row.querySelector('.detail-item-paid');
            paidInput.value = ((qty * price * pct) / 100).toFixed(2);
        }

        // Save inline edits for a line item
        async function saveItemEdits(itemId, invoiceId) {
            const row = document.querySelector(`[data-detail-item-id="${itemId}"]`);
            if (!row) return;

            const quantity = parseInt(row.querySelector('.detail-item-qty').value) || 1;
            const price = parseFloat(row.querySelector('.detail-item-price').value) || 0;
            const due_date = row.querySelector('.detail-item-due-date').value || null;
            const amount_paid = parseFloat(row.querySelector('.detail-item-paid').value) || 0;
            const upfront_pct = parseInt(row.querySelector('.detail-item-upfront').value) || 0;

            try {
                const res = await fetch(`${API_BASE}/invoices/items/${itemId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ quantity, price, due_date, amount_paid, upfront_pct })
                });
                if (res.ok) {
                    showToast('Item updated', 'success');
                    await viewInvoiceDetails(invoiceId);
                    loadInvoices();
                } else {
                    showToast('Failed to save item', 'error');
                }
            } catch (error) {
                console.error('Save item edits error:', error);
                showToast('Failed to save item', 'error');
            }
        }

        // Credit transfer
        let transferFromItemId = null;
        let transferInvoiceId = null;

        function transferCredit(fromItemId, invoiceId) {
            const fromItem = currentDetailItems.find(i => i.id === fromItemId);
            if (!fromItem || Number(fromItem.amount_paid || 0) <= 0) {
                showToast('No credit available to transfer', 'error');
                return;
            }

            transferFromItemId = fromItemId;
            transferInvoiceId = invoiceId;

            document.getElementById('transfer-from-name').textContent = fromItem.service_name;
            document.getElementById('transfer-available').textContent = `$${Number(fromItem.amount_paid).toFixed(2)}`;
            document.getElementById('transfer-amount').value = '';
            document.getElementById('transfer-amount').max = Number(fromItem.amount_paid);

            const toSelect = document.getElementById('transfer-to-item');
            toSelect.innerHTML = currentDetailItems
                .filter(i => i.id !== fromItemId)
                .map(i => `<option value="${i.id}">${i.service_name} (Balance: $${(Number(i.total) - Number(i.amount_paid || 0)).toFixed(2)})</option>`)
                .join('');

            document.getElementById('transfer-credit-modal').classList.remove('hidden');
        }

        function closeTransferModal() {
            document.getElementById('transfer-credit-modal').classList.add('hidden');
            transferFromItemId = null;
            transferInvoiceId = null;
        }

        async function executeTransfer() {
            if (!transferFromItemId || !transferInvoiceId) return;

            const toItemId = document.getElementById('transfer-to-item').value;
            const amount = parseFloat(document.getElementById('transfer-amount').value);
            const fromItem = currentDetailItems.find(i => i.id === transferFromItemId);
            const toItem = currentDetailItems.find(i => i.id === parseInt(toItemId));

            if (!toItemId || !amount || amount <= 0) {
                showToast('Please select a target and enter an amount', 'error');
                return;
            }
            if (amount > Number(fromItem.amount_paid)) {
                showToast('Amount exceeds available credit', 'error');
                return;
            }

            try {
                // Apply credit to target item (source keeps its payment)
                await fetch(`${API_BASE}/invoices/items/${toItemId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ amount_paid: Number(toItem.amount_paid || 0) + amount })
                });

                const invoiceId = transferInvoiceId;
                closeTransferModal();
                showToast(`Applied $${amount.toFixed(2)} credit from "${fromItem.service_name}" to "${toItem.service_name}"`, 'success');
                await viewInvoiceDetails(invoiceId);
                loadInvoices();
            } catch (error) {
                console.error('Transfer credit error:', error);
                showToast('Failed to transfer credit', 'error');
            }
        }

        async function showCreateInvoice() {
            await loadClientSelects();
            await loadServices();
            document.getElementById('create-invoice-modal').classList.remove('hidden');
            document.getElementById('invoice-items-container').innerHTML = '';
            invoiceItemCounter = 0;
            addInvoiceItem();
            document.getElementById('invoice-date').valueAsDate = new Date();
        }

        function closeCreateInvoiceModal() {
            document.getElementById('create-invoice-modal').classList.add('hidden');
            document.getElementById('create-invoice-form').reset();
        }

        function addInvoiceItem() {
            invoiceItemCounter++;
            const container = document.getElementById('invoice-items-container');
            const itemHtml = `
                <div class="invoice-item border border-border-dark dark:border-border-light rounded p-3" data-item-id="${invoiceItemCounter}">
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        <div class="col-span-2">
                            <label class="block text-xs mb-1">Service</label>
                            <select class="item-service w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" onchange="updateItemPrice(${invoiceItemCounter})" required>
                                <option value="">Select service...</option>
                                ${servicesData.map(s => `<option value="${s.id}" data-price="${s.price}" data-sessions="${s.sessions || 1}" data-name="${s.name}">${s.name} ($${s.price})${(s.sessions || 1) > 1 ? ' [' + s.sessions + ' wks]' : ''}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs mb-1">Qty</label>
                            <input type="number" class="item-quantity w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" value="1" min="1" onchange="calculateInvoiceTotal()" required>
                        </div>
                        <div>
                            <label class="block text-xs mb-1">Price</label>
                            <input type="number" step="0.01" class="item-price w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" required>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div>
                            <label class="block text-xs mb-1">Due Date</label>
                            <div class="flex items-center gap-1">
                                <input type="date" class="item-due-date flex-1 text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light min-h-[44px]">
                                <button type="button" onclick="this.closest('div').querySelector('input').value=''" class="text-gray-400 hover:text-red-400 p-0.5 flex-shrink-0" title="Clear"><span class="material-icons text-xs">close</span></button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs mb-1">Upfront %</label>
                            <select class="item-upfront-pct w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" onchange="applyCreateUpfrontPct(this)">
                                <option value="0">0%</option>
                                <option value="25">25%</option>
                                <option value="50">50%</option>
                                <option value="75">75%</option>
                                <option value="100">100%</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs mb-1">Amount Paid</label>
                            <input type="number" step="0.01" min="0" class="item-amount-paid w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" value="0">
                        </div>
                        <div></div>
                        <div class="flex items-end">
                            <button type="button" onclick="removeInvoiceItem(${invoiceItemCounter})" class="w-full bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-700">Remove</button>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', itemHtml);
        }

        function applyCreateUpfrontPct(selectEl) {
            const itemDiv = selectEl.closest('.invoice-item');
            const qty = parseInt(itemDiv.querySelector('.item-quantity').value) || 1;
            const price = parseFloat(itemDiv.querySelector('.item-price').value) || 0;
            const pct = parseInt(selectEl.value) || 0;
            itemDiv.querySelector('.item-amount-paid').value = ((qty * price * pct) / 100).toFixed(2);
            calculateInvoiceTotal();
        }

        function removeInvoiceItem(itemId) {
            const item = document.querySelector(`[data-item-id="${itemId}"]`);
            if (item) {
                item.remove();
                calculateInvoiceTotal();
            }
        }

        function updateItemPrice(itemId) {
            const item = document.querySelector(`[data-item-id="${itemId}"]`);
            const select = item.querySelector('.item-service');
            const priceInput = item.querySelector('.item-price');
            const selectedOption = select.options[select.selectedIndex];

            if (selectedOption && selectedOption.dataset.price) {
                const sessions = parseInt(selectedOption.dataset.sessions) || 1;
                const totalPrice = parseFloat(selectedOption.dataset.price);

                if (sessions > 1) {
                    // Auto-split: remove this item and create N session items
                    const serviceName = selectedOption.dataset.name;
                    const serviceId = selectedOption.value;
                    const perSessionPrice = Math.round((totalPrice / sessions) * 100) / 100;
                    const dueDateVal = item.querySelector('.item-due-date').value;

                    item.remove(); // Remove the original item

                    for (let i = 0; i < sessions; i++) {
                        invoiceItemCounter++;
                        let weekDueDate = '';
                        if (dueDateVal) {
                            const d = new Date(dueDateVal + 'T00:00:00');
                            d.setDate(d.getDate() + (i * 7));
                            weekDueDate = d.toISOString().split('T')[0];
                        }
                        const weekHtml = `
                            <div class="invoice-item border border-border-dark dark:border-border-light rounded p-3" data-item-id="${invoiceItemCounter}" data-split-service="${serviceId}" data-split-name="${serviceName}">
                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                    <div class="col-span-2">
                                        <label class="block text-xs mb-1">Service</label>
                                        <input type="text" class="item-service-name w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light bg-opacity-50" value="${serviceName} - Week ${i + 1}" readonly>
                                        <input type="hidden" class="item-service-id" value="${serviceId}">
                                    </div>
                                    <div>
                                        <label class="block text-xs mb-1">Qty</label>
                                        <input type="number" class="item-quantity w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" value="1" min="1" onchange="calculateInvoiceTotal()" required>
                                    </div>
                                    <div>
                                        <label class="block text-xs mb-1">Price</label>
                                        <input type="number" step="0.01" class="item-price w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" value="${perSessionPrice}" required>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    <div>
                                        <label class="block text-xs mb-1">Due Date</label>
                                        <div class="flex items-center gap-1">
                                            <input type="date" class="item-due-date flex-1 text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light min-h-[44px]" value="${weekDueDate}">
                                            <button type="button" onclick="this.closest('div').querySelector('input').value=''" class="text-gray-400 hover:text-red-400 p-0.5 flex-shrink-0" title="Clear"><span class="material-icons text-xs">close</span></button>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-xs mb-1">Upfront %</label>
                                        <select class="item-upfront-pct w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" onchange="applyCreateUpfrontPct(this)">
                                            <option value="0">0%</option>
                                            <option value="25">25%</option>
                                            <option value="50">50%</option>
                                            <option value="75">75%</option>
                                            <option value="100">100%</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-xs mb-1">Amount Paid</label>
                                        <input type="number" step="0.01" min="0" class="item-amount-paid w-full text-sm rounded-md border-gray-600 dark:border-gray-300 bg-background-dark dark:bg-white text-text-dark dark:text-text-light" value="0">
                                    </div>
                                    <div></div>
                                    <div class="flex items-end">
                                        <button type="button" onclick="removeInvoiceItem(${invoiceItemCounter})" class="w-full bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-700">Remove</button>
                                    </div>
                                </div>
                            </div>
                        `;
                        document.getElementById('invoice-items-container').insertAdjacentHTML('beforeend', weekHtml);
                    }
                    calculateInvoiceTotal();
                } else {
                    priceInput.value = totalPrice;
                    calculateInvoiceTotal();
                }
            }
        }

        function calculateInvoiceTotal() {
            const items = document.querySelectorAll('.invoice-item');
            let subtotal = 0;

            items.forEach(item => {
                const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
                const price = parseFloat(item.querySelector('.item-price').value) || 0;
                subtotal += quantity * price;
            });

            const discountType = document.getElementById('invoice-discount-type').value;
            const discountValue = parseFloat(document.getElementById('invoice-discount-value').value) || 0;
            let discountAmount = 0;
            if (discountType === 'percentage') {
                discountAmount = subtotal * (discountValue / 100);
            } else if (discountType === 'fixed') {
                discountAmount = Math.min(discountValue, subtotal);
            }

            const discountRow = document.getElementById('invoice-discount-row');
            if (discountAmount > 0) {
                discountRow.classList.remove('hidden');
                document.getElementById('invoice-discount-label').textContent = discountType === 'percentage' ? `Discount (${discountValue}%):` : 'Discount:';
                document.getElementById('invoice-discount-display').textContent = `-$${discountAmount.toFixed(2)}`;
            } else {
                discountRow.classList.add('hidden');
            }

            const taxableAmount = subtotal - discountAmount;
            const taxRate = parseFloat(document.getElementById('invoice-tax-rate').value) || 0;
            const taxAmount = taxableAmount * (taxRate / 100);
            const total = taxableAmount + taxAmount;

            document.getElementById('invoice-subtotal').textContent = `$${subtotal.toFixed(2)}`;
            document.getElementById('invoice-tax').textContent = `$${taxAmount.toFixed(2)}`;
            document.getElementById('invoice-total').textContent = `$${total.toFixed(2)}`;
        }

        document.getElementById('invoice-tax-rate').addEventListener('input', calculateInvoiceTotal);

        function toggleInvoiceNonClient() {
            const isNonClient = document.getElementById('invoice-non-client-toggle').checked;
            const clientField = document.getElementById('invoice-client-field');
            const recipientFields = document.getElementById('invoice-recipient-fields');
            const clientSelect = document.getElementById('invoice-client-select');

            if (isNonClient) {
                clientField.classList.add('hidden');
                recipientFields.classList.remove('hidden');
                clientSelect.removeAttribute('required');
                clientSelect.value = '';
                document.getElementById('invoice-recipient-name').setAttribute('required', '');
                document.getElementById('invoice-recipient-email').setAttribute('required', '');
                // Fetch contacts for the dropdown (Contact-to-Invoice linking)
                fetch(`${API_BASE}/contacts`, { headers: getAuthHeaders() })
                    .then(r => r.json())
                    .then(data => {
                        const sel = document.getElementById('invoice-contact-select');
                        sel.innerHTML = '<option value="">-- Enter manually --</option>';
                        (data.contacts || []).forEach(c => {
                            sel.innerHTML += `<option value="${c.id}" data-name="${c.name || ''}" data-email="${c.email || ''}">${c.name}${c.email ? ' (' + c.email + ')' : ''}</option>`;
                        });
                    }).catch(() => {});
            } else {
                clientField.classList.remove('hidden');
                recipientFields.classList.add('hidden');
                clientSelect.setAttribute('required', '');
                document.getElementById('invoice-recipient-name').removeAttribute('required');
                document.getElementById('invoice-recipient-email').removeAttribute('required');
                document.getElementById('invoice-recipient-name').value = '';
                document.getElementById('invoice-recipient-email').value = '';
                // Reset contact select
                const sel = document.getElementById('invoice-contact-select');
                if (sel) { sel.value = ''; sel.innerHTML = '<option value="">-- Enter manually --</option>'; }
            }
        }

        function fillInvoiceFromContact() {
            const sel = document.getElementById('invoice-contact-select');
            const opt = sel.options[sel.selectedIndex];
            if (sel.value) {
                document.getElementById('invoice-recipient-name').value = opt.dataset.name || '';
                document.getElementById('invoice-recipient-email').value = opt.dataset.email || '';
            }
        }

        document.getElementById('create-invoice-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const isNonClient = document.getElementById('invoice-non-client-toggle').checked;
            const clientId = isNonClient ? 0 : document.getElementById('invoice-client-select').value;
            const recipientName = document.getElementById('invoice-recipient-name').value;
            const recipientEmail = document.getElementById('invoice-recipient-email').value;
            const trainerName = document.getElementById('invoice-trainer').value;
            const date = document.getElementById('invoice-date').value;
            const dueDate = document.getElementById('invoice-due-date').value;
            const taxRate = parseFloat(document.getElementById('invoice-tax-rate').value);
            const notes = document.getElementById('invoice-notes').value;

            if (isNonClient && (!recipientEmail || !recipientName)) {
                showToast('Recipient name and email are required', 'error');
                return;
            }

            // Collect items (handles both regular and auto-split items)
            const items = [];
            document.querySelectorAll('.invoice-item').forEach(item => {
                let serviceId, serviceName;
                const serviceSelect = item.querySelector('.item-service');
                const splitServiceId = item.dataset.splitService;

                if (splitServiceId) {
                    // Auto-split item
                    serviceId = splitServiceId;
                    serviceName = item.querySelector('.item-service-name').value;
                } else if (serviceSelect) {
                    serviceId = serviceSelect.value;
                    serviceName = serviceSelect.options[serviceSelect.selectedIndex]?.dataset?.name || serviceSelect.options[serviceSelect.selectedIndex]?.text?.split('($')[0]?.trim() || 'Service';
                }

                const quantity = parseInt(item.querySelector('.item-quantity').value);
                const price = parseFloat(item.querySelector('.item-price').value);
                const dueDate = item.querySelector('.item-due-date').value || null;
                const amountPaid = parseFloat(item.querySelector('.item-amount-paid').value) || 0;
                const upfrontPct = parseInt(item.querySelector('.item-upfront-pct')?.value) || 0;

                if (serviceId && quantity && price) {
                    items.push({ service_id: serviceId, service_name: serviceName, quantity, price, due_date: dueDate, amount_paid: amountPaid, upfront_pct: upfrontPct });
                }
            });

            if (items.length === 0) {
                showToast('Please add at least one invoice item', 'error');
                return;
            }

            try {
                const discountType = document.getElementById('invoice-discount-type').value || null;
                const discountValue = parseFloat(document.getElementById('invoice-discount-value').value) || 0;
                const body = {
                    client_id: isNonClient ? 0 : parseInt(clientId),
                    trainer_name: trainerName,
                    date,
                    due_date: dueDate || null,
                    tax_rate: taxRate,
                    discount_type: discountType,
                    discount_value: discountValue,
                    items,
                    notes
                };
                if (isNonClient) {
                    body.recipient_name = recipientName;
                    body.recipient_email = recipientEmail;
                    // Link invoice to contact if selected from dropdown
                    const contactSelect = document.getElementById('invoice-contact-select');
                    const contact_id = contactSelect ? parseInt(contactSelect.value) || null : null;
                    if (contact_id) body.contact_id = contact_id;
                }
                const res = await fetch(`${API_BASE}/invoices`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(body)
                });

                const data = await res.json();

                if (res.ok) {
                    showToast(`Invoice #${data.invoice.invoice_number} created`, 'success');
                    closeCreateInvoiceModal();
                    loadInvoices();
                } else {
                    showToast(data.error || 'Failed to create invoice', 'error');
                }
            } catch (error) {
                console.error('Create invoice error:', error);
                showToast('Failed to create invoice', 'error');
            }
        });

        // NOTIFICATIONS FUNCTIONS
        let notifPanelOpen = false;

        function toggleNotifications() {
            notifPanelOpen = !notifPanelOpen;
            document.getElementById('notif-panel').classList.toggle('hidden', !notifPanelOpen);
            if (notifPanelOpen) loadNotifications();
        }

        // Close notification panel when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notif-panel');
            const bell = e.target.closest('[onclick="toggleNotifications()"]');
            if (!bell && !panel.contains(e.target) && notifPanelOpen) {
                notifPanelOpen = false;
                panel.classList.add('hidden');
            }
        });

        async function loadNotifications() {
            try {
                const res = await fetch(`${API_BASE}/notifications?limit=20`, { headers: getAuthHeaders() });
                const data = await res.json();
                const notifs = data.notifications || [];
                const notifList = document.getElementById('notif-list');

                if (notifs.length === 0) {
                    notifList.innerHTML = '<p class="p-4 text-gray-400 dark:text-gray-600 text-sm">No notifications</p>';
                } else {
                    const typeIcons = {
                        'new_booking': 'event',
                        'booking_cancelled': 'event_busy',
                        'client_media_upload': 'photo_camera',
                        'service_request': 'room_service',
                        'new_client_registration': 'person_add',
                        'client_note': 'note',
                        'new_dog': 'pets'
                    };
                    notifList.innerHTML = notifs.map(n => `
                        <div class="p-3 hover:bg-background-dark dark:hover:bg-gray-50 cursor-pointer flex items-start gap-3 ${n.is_read ? 'opacity-60' : ''}" onclick="markNotifRead(${n.id})">
                            <span class="material-icons text-primary mt-0.5">${typeIcons[n.type] || 'notifications'}</span>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold ${n.is_read ? '' : 'text-primary'}">${n.title}</p>
                                <p class="text-xs text-gray-400 dark:text-gray-600 truncate">${n.message}</p>
                                <p class="text-xs text-gray-500 mt-1">${timeAgo(n.created_at)}</p>
                            </div>
                            ${n.is_read ? '' : '<span class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>'}
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Error loading notifications:', error);
            }
        }

        async function fetchUnreadCount() {
            try {
                const res = await fetch(`${API_BASE}/notifications?unread_only=true&limit=1`, { headers: getAuthHeaders() });
                const data = await res.json();
                const badge = document.getElementById('notif-badge');
                const count = data.unread_count || 0;
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            } catch (error) {
                console.error('Error fetching unread count:', error);
            }
        }

        async function markNotifRead(id) {
            try {
                await fetch(`${API_BASE}/notifications/${id}`, { method: 'PUT', headers: getAuthHeaders() });
                loadNotifications();
                fetchUnreadCount();
            } catch (error) {
                console.error('Mark read error:', error);
            }
        }

        async function markAllNotificationsRead() {
            try {
                const res = await fetch(`${API_BASE}/notifications/read-all`, { method: 'POST', headers: getAuthHeaders() });
                const data = await res.json();
                if (data.success) {
                    showToast('All notifications marked as read', 'success');
                    await loadNotifications();
                    await fetchUnreadCount();
                } else {
                    showToast(data.error || 'Failed to mark notifications', 'error');
                }
            } catch (error) {
                console.error('Mark all read error:', error);
                showToast('Failed to mark notifications read', 'error');
            }
        }

        async function clearAllNotifications() {
            if (!confirm('Clear all notifications?')) return;
            try {
                const res = await fetch(`${API_BASE}/notifications/clear`, { method: 'POST', headers: getAuthHeaders() });
                const data = await res.json();
                if (data.success) {
                    showToast('All notifications cleared', 'success');
                    await loadNotifications();
                    await fetchUnreadCount();
                } else {
                    showToast(data.error || 'Failed to clear notifications', 'error');
                }
            } catch (error) {
                console.error('Clear notifications error:', error);
                showToast('Failed to clear notifications', 'error');
            }
        }

        function timeAgo(dateStr) {
            const now = new Date();
            const date = new Date(dateStr);
            const diff = Math.floor((now - date) / 1000);
            if (diff < 60) return 'just now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            return `${Math.floor(diff / 86400)}d ago`;
        }

        // Poll for notifications every 60 seconds
        setInterval(fetchUnreadCount, 60000);

        // SCHEDULE MANAGEMENT FUNCTIONS
        const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        let calendarYear, calendarMonth;
        let selectedDates = new Set();
        let lastClickedDate = null;
        let cachedAvailabilitySlots = [];
        let cachedBlockedDates = [];
        let cachedAppointments = [];

        async function showSchedule() {
            showSection('schedule-section');
            const now = new Date();
            calendarYear = now.getFullYear();
            calendarMonth = now.getMonth();
            await loadCalendarData();
            checkPendingReminders();
        }

        async function checkPendingReminders() {
            try {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                const res = await fetch(`${API_BASE}/appointments?date=${tomorrowStr}`, { headers: getAuthHeaders() });
                const data = await res.json();
                const appts = (data.appointments || []).filter(a =>
                    ['pending', 'confirmed'].includes(a.status) && !a.reminder_sent
                );
                const badge = document.getElementById('reminder-badge');
                if (appts.length > 0) {
                    badge.textContent = appts.length;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            } catch (e) { console.error('Check reminders error:', e); }
        }

        async function sendAppointmentReminders() {
            const btn = document.getElementById('send-reminders-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons text-sm animate-spin">sync</span> Sending...';
            try {
                const res = await fetch(`${API_BASE}/appointments/send-reminders`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (res.ok) {
                    if (data.sent > 0) {
                        showToast(`Sent ${data.sent} reminder(s) for ${data.date}`, 'success');
                    } else {
                        showToast('No reminders to send for tomorrow', 'info');
                    }
                    document.getElementById('reminder-badge').classList.add('hidden');
                } else {
                    showToast(data.error || 'Failed to send reminders', 'error');
                }
            } catch (e) {
                showToast('Failed to send reminders', 'error');
            }
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons text-sm">notifications_active</span> Send Reminders <span id="reminder-badge" class="hidden bg-white text-yellow-600 text-xs font-bold px-1.5 py-0.5 rounded-full ml-1">0</span>';
            checkPendingReminders();
        }

        async function loadCalendarData() {
            const [availResult, blockedResult, apptResult] = await Promise.allSettled([
                fetch(`${API_BASE}/availability`, { headers: getAuthHeaders() }).then(r => r.json()),
                fetch(`${API_BASE}/availability/blocked`, { headers: getAuthHeaders() }).then(r => r.json()),
                fetch(`${API_BASE}/appointments`, { headers: getAuthHeaders() }).then(r => r.json())
            ]);
            if (availResult.status === 'fulfilled') cachedAvailabilitySlots = availResult.value.slots || [];
            if (blockedResult.status === 'fulfilled') cachedBlockedDates = blockedResult.value.blocked_dates || [];
            if (apptResult.status === 'fulfilled') cachedAppointments = apptResult.value.appointments || [];
            renderCalendar();
            renderAvailabilityList();
            renderBlockedDatesList();
            renderAppointmentsList();
        }

        function renderCalendar() {
            document.getElementById('calendar-month-label').textContent = `${MONTH_NAMES[calendarMonth]} ${calendarYear}`;
            const grid = document.getElementById('calendar-grid');
            const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
            const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

            // Build lookups — recurring DOW availability (with date range check) + specific date availability
            const activeSlots = cachedAvailabilitySlots.filter(s => s.is_active);
            const recurringSlots = activeSlots.filter(s => !s.specific_date);
            const specificDateAvail = new Set(activeSlots.filter(s => s.specific_date).map(s => s.specific_date));

            // Helper: check if a date string falls within a recurring slot's date range
            function isRecurringAvailable(dateStr, dow) {
                return recurringSlots.some(s => s.day_of_week === dow
                    && (!s.recurring_start_date || s.recurring_start_date <= dateStr)
                    && (!s.recurring_end_date || s.recurring_end_date >= dateStr));
            }
            const blockedDateSet = new Set(cachedBlockedDates.map(d => d.blocked_date));
            const appointmentDates = new Map();
            (cachedAppointments || []).filter(a => a.status === 'pending' || a.status === 'confirmed').forEach(a => {
                appointmentDates.set(a.appointment_date, (appointmentDates.get(a.appointment_date) || 0) + 1);
            });

            let html = '';
            // Empty cells for offset
            for (let i = 0; i < firstDay; i++) {
                html += '<div class="min-h-[3rem]"></div>';
            }
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const dow = new Date(calendarYear, calendarMonth, day).getDay();
                const isAvailable = isRecurringAvailable(dateStr, dow) || specificDateAvail.has(dateStr);
                const isBlocked = blockedDateSet.has(dateStr);
                const hasAppt = appointmentDates.has(dateStr);
                const isSelected = selectedDates.has(dateStr);
                const isToday = dateStr === todayStr;
                const isPast = new Date(calendarYear, calendarMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                let bgClass = 'border-border-dark dark:border-border-light';
                if (isBlocked) bgClass = 'bg-red-500/10 border-red-500/30';
                else if (isAvailable) bgClass = 'bg-green-500/10 border-green-500/30';

                let ringClass = isSelected ? 'ring-2 ring-primary bg-primary/20' : '';
                let opacityClass = isPast ? 'opacity-40' : '';
                let dayNumClass = isToday ? 'font-bold underline' : '';

                html += `<div class="border rounded p-1 min-h-[3rem] cursor-pointer select-none transition-all ${bgClass} ${ringClass} ${opacityClass} hover:brightness-110"
                    data-date="${dateStr}" onclick="handleDayClick('${dateStr}', event)">
                    <span class="text-sm ${dayNumClass}">${day}</span>
                    <div class="flex gap-0.5 mt-0.5">
                        ${isAvailable && !isBlocked ? '<span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>' : ''}
                        ${isBlocked ? '<span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span>' : ''}
                        ${hasAppt ? '<span class="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>' : ''}
                    </div>
                </div>`;
            }
            // Trailing empty cells
            const totalCells = firstDay + daysInMonth;
            const remainder = totalCells % 7;
            if (remainder > 0) {
                for (let i = 0; i < 7 - remainder; i++) {
                    html += '<div class="min-h-[3rem]"></div>';
                }
            }
            grid.innerHTML = html;
            updateSelectionBar();
        }

        function handleDayClick(dateStr, event) {
            if (event.shiftKey && lastClickedDate) {
                selectRange(lastClickedDate, dateStr);
            } else if (event.ctrlKey || event.metaKey) {
                if (selectedDates.has(dateStr)) selectedDates.delete(dateStr);
                else selectedDates.add(dateStr);
            } else {
                // If clicking same single date that's already selected, show day detail
                if (selectedDates.size === 1 && selectedDates.has(dateStr)) {
                    showDayDetail(dateStr);
                    return;
                }
                selectedDates.clear();
                selectedDates.add(dateStr);
            }
            lastClickedDate = dateStr;
            renderCalendar();
        }

        function selectRange(from, to) {
            const start = new Date(from + 'T00:00:00');
            const end = new Date(to + 'T00:00:00');
            const [lo, hi] = start <= end ? [start, end] : [end, start];
            const d = new Date(lo);
            while (d <= hi) {
                const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                selectedDates.add(ds);
                d.setDate(d.getDate() + 1);
            }
        }

        function selectWeekdays() {
            const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const dow = new Date(calendarYear, calendarMonth, day).getDay();
                if (dow >= 1 && dow <= 5) {
                    selectedDates.add(`${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
                }
            }
            renderCalendar();
        }

        function selectAllDays() {
            const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                selectedDates.add(`${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
            }
            renderCalendar();
        }

        function clearSelection() {
            selectedDates.clear();
            lastClickedDate = null;
            renderCalendar();
        }

        function updateSelectionBar() {
            const bar = document.getElementById('selection-bar');
            const count = selectedDates.size;
            if (count === 0) {
                bar.classList.add('hidden');
            } else {
                bar.classList.remove('hidden');
                document.getElementById('selection-count').textContent = `${count} day${count > 1 ? 's' : ''} selected`;
            }
        }

        function prevMonth() {
            calendarMonth--;
            if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
            selectedDates.clear();
            lastClickedDate = null;
            renderCalendar();
        }

        function nextMonth() {
            calendarMonth++;
            if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
            selectedDates.clear();
            lastClickedDate = null;
            renderCalendar();
        }

        function goToday() {
            const now = new Date();
            calendarYear = now.getFullYear();
            calendarMonth = now.getMonth();
            selectedDates.clear();
            lastClickedDate = null;
            renderCalendar();
        }

        // Bulk Availability Modal
        let selectedRecurringDOWs = new Set();

        function toggleAvailType() {
            const type = document.querySelector('input[name="avail-type"]:checked').value;
            document.getElementById('recurring-options').classList.toggle('hidden', type !== 'recurring');
            document.getElementById('replace-option').classList.toggle('hidden', type !== 'recurring');
        }

        function openBulkAvailabilityModal() {
            if (selectedDates.size === 0) {
                showToast('Select one or more days on the calendar first.', 'info');
                return;
            }
            const dows = new Set();
            selectedDates.forEach(ds => {
                const d = new Date(ds + 'T00:00:00');
                dows.add(d.getDay());
            });
            const dayNames = [...dows].sort().map(d => DAY_NAMES[d]);
            const dateCount = selectedDates.size;
            document.getElementById('bulk-avail-days').textContent = `${dateCount} date${dateCount > 1 ? 's' : ''} selected (${dayNames.join(', ')})`;

            // Build recurring day buttons
            selectedRecurringDOWs = new Set(dows);
            renderRecurringDayButtons();

            // Set default recurring date range from selected dates
            const sortedDates = [...selectedDates].sort();
            document.getElementById('recurring-start-date').value = sortedDates[0];
            // Default end date to 3 months from start
            const endDefault = new Date(sortedDates[0] + 'T00:00:00');
            endDefault.setMonth(endDefault.getMonth() + 3);
            document.getElementById('recurring-end-date').value = endDefault.toISOString().split('T')[0];

            // Default to "specific" for single date, show both options
            if (dateCount === 1) {
                document.querySelector('input[name="avail-type"][value="specific"]').checked = true;
            }
            toggleAvailType();
            document.getElementById('bulk-availability-modal').classList.remove('hidden');
        }

        function renderRecurringDayButtons() {
            const container = document.getElementById('recurring-day-buttons');
            container.innerHTML = DAY_NAMES.map((name, i) => {
                const active = selectedRecurringDOWs.has(i);
                return `<button type="button" onclick="toggleRecurringDay(${i})" class="px-3 py-1 rounded text-xs font-medium transition-colors ${active ? 'bg-primary text-white' : 'bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-800 opacity-50'}">${name.substring(0, 3)}</button>`;
            }).join('');
        }

        function toggleRecurringDay(dow) {
            if (selectedRecurringDOWs.has(dow)) selectedRecurringDOWs.delete(dow);
            else selectedRecurringDOWs.add(dow);
            renderRecurringDayButtons();
        }

        function setRecurringPreset(preset) {
            selectedRecurringDOWs.clear();
            if (preset === 'auto') {
                selectedDates.forEach(ds => {
                    selectedRecurringDOWs.add(new Date(ds + 'T00:00:00').getDay());
                });
            } else if (preset === 'weekdays') {
                [1,2,3,4,5].forEach(d => selectedRecurringDOWs.add(d));
            } else if (preset === 'all') {
                [0,1,2,3,4,5,6].forEach(d => selectedRecurringDOWs.add(d));
            }
            renderRecurringDayButtons();
        }

        function closeBulkAvailabilityModal() {
            document.getElementById('bulk-availability-modal').classList.add('hidden');
            document.getElementById('bulk-availability-form').reset();
        }

        async function clearAllAvailability() {
            showConfirmModal('Clear All Availability', 'Remove ALL availability slots? This cannot be undone.', async () => {
                try {
                    const results = await Promise.all(cachedAvailabilitySlots.map(s =>
                        fetch(`${API_BASE}/availability/${s.id}`, { method: 'DELETE', headers: getAuthHeaders() })
                    ));
                    const failed = results.filter(r => !r.ok);
                    if (failed.length > 0) {
                        showToast(`${failed.length} slot(s) failed to delete. Please try again.`, 'error');
                    }
                    await loadCalendarData();
                } catch (error) {
                    console.error('Clear all availability error:', error);
                    showToast('Failed to clear availability — network error.', 'error');
                }
            }, 'Clear All');
        }

        document.getElementById('bulk-availability-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const startTime = document.getElementById('bulk-avail-start').value;
            const endTime = document.getElementById('bulk-avail-end').value;
            const duration = parseInt(document.getElementById('bulk-avail-duration').value);
            const availType = document.querySelector('input[name="avail-type"]:checked').value;
            const replaceExisting = document.getElementById('bulk-avail-replace').checked;

            try {
                if (availType === 'specific') {
                    // Create one slot per selected date with specific_date set
                    const results = await Promise.all([...selectedDates].map(dateStr => {
                        const dow = new Date(dateStr + 'T00:00:00').getDay();
                        return fetch(`${API_BASE}/availability`, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ day_of_week: dow, start_time: startTime, end_time: endTime, slot_duration_minutes: duration, specific_date: dateStr })
                        });
                    }));
                    if (!results.every(r => r.ok)) showToast('Some slots failed to save.', 'error');
                } else {
                    // Recurring: use selectedRecurringDOWs
                    if (selectedRecurringDOWs.size === 0) {
                        showToast('Select at least one day of the week for recurring availability.', 'error');
                        return;
                    }
                    const recurringStartDate = document.getElementById('recurring-start-date').value;
                    const recurringEndDate = document.getElementById('recurring-end-date').value;
                    if (!recurringStartDate || !recurringEndDate) {
                        showToast('Please set both a start date and end date for the recurring schedule.', 'error');
                        return;
                    }
                    if (recurringEndDate < recurringStartDate) {
                        showToast('End date must be on or after the start date.', 'error');
                        return;
                    }
                    if (replaceExisting) {
                        const toDelete = cachedAvailabilitySlots.filter(s => !s.specific_date && selectedRecurringDOWs.has(s.day_of_week));
                        await Promise.all(toDelete.map(s =>
                            fetch(`${API_BASE}/availability/${s.id}`, { method: 'DELETE', headers: getAuthHeaders() })
                        ));
                    }
                    const results = await Promise.all([...selectedRecurringDOWs].map(dow =>
                        fetch(`${API_BASE}/availability`, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ day_of_week: dow, start_time: startTime, end_time: endTime, slot_duration_minutes: duration, recurring_start_date: recurringStartDate, recurring_end_date: recurringEndDate })
                        })
                    ));
                    if (!results.every(r => r.ok)) showToast('Some availability slots failed to save.', 'error');
                }
                closeBulkAvailabilityModal();
                clearSelection();
                await loadCalendarData();
            } catch (error) {
                console.error('Bulk availability error:', error);
                showToast('Failed to set availability', 'error');
            }
        });

        async function deleteAvailability(id) {
            showConfirmModal('Remove Availability', 'Remove this availability slot?', async () => {
                try {
                    const res = await fetch(`${API_BASE}/availability/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        showToast(data.error || `Failed to remove slot (${res.status})`, 'error');
                        return;
                    }
                    await loadCalendarData();
                } catch (error) {
                    console.error('Delete availability error:', error);
                    showToast('Network error — could not remove slot. Please try again.', 'error');
                }
            }, 'Remove');
        }

        // Bulk Block Modal
        function openBulkBlockModal() {
            if (selectedDates.size === 0) {
                showToast('Select one or more days on the calendar first.', 'info');
                return;
            }
            document.getElementById('bulk-block-info').textContent = `Blocking ${selectedDates.size} specific date${selectedDates.size > 1 ? 's' : ''}`;
            document.getElementById('bulk-block-modal').classList.remove('hidden');
        }

        function closeBulkBlockModal() {
            document.getElementById('bulk-block-modal').classList.add('hidden');
            document.getElementById('bulk-block-form').reset();
        }

        document.getElementById('bulk-block-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const reason = document.getElementById('bulk-block-reason').value || null;
            const blockedDateSet = new Set(cachedBlockedDates.map(d => d.blocked_date));
            const datesToBlock = [...selectedDates].filter(d => !blockedDateSet.has(d));

            if (datesToBlock.length === 0) {
                showToast('All selected dates are already blocked.', 'info');
                closeBulkBlockModal();
                return;
            }

            try {
                const results = await Promise.all(datesToBlock.map(dateStr =>
                    fetch(`${API_BASE}/availability/blocked`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ blocked_date: dateStr, reason })
                    })
                ));
                const allOk = results.every(r => r.ok);
                if (!allOk) showToast('Some dates failed to block.', 'error');
                closeBulkBlockModal();
                clearSelection();
                await loadCalendarData();
            } catch (error) {
                console.error('Bulk block error:', error);
                showToast('Failed to block dates', 'error');
            }
        });

        async function bulkUnblock() {
            if (selectedDates.size === 0) return;
            const toUnblock = cachedBlockedDates.filter(d => selectedDates.has(d.blocked_date));
            if (toUnblock.length === 0) {
                showToast('None of the selected dates are blocked.', 'info');
                return;
            }
            showConfirmModal('Unblock Dates', `Unblock ${toUnblock.length} date${toUnblock.length > 1 ? 's' : ''}?`, async () => {
                try {
                    await Promise.all(toUnblock.map(d =>
                        fetch(`${API_BASE}/availability/blocked/${d.id}`, { method: 'DELETE', headers: getAuthHeaders() })
                    ));
                    clearSelection();
                    await loadCalendarData();
                } catch (error) {
                    console.error('Bulk unblock error:', error);
                }
            }, 'Unblock');
        }

        async function unblockDate(id) {
            showConfirmModal('Unblock Date', 'Unblock this date?', async () => {
                try {
                    await fetch(`${API_BASE}/availability/blocked/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                    await loadCalendarData();
                } catch (error) {
                    console.error('Unblock date error:', error);
                }
            }, 'Unblock');
        }

        function renderAvailabilityList() {
            const slots = cachedAvailabilitySlots;
            const container = document.getElementById('availability-table');
            if (slots.length === 0) {
                container.innerHTML = '<div class="p-3 border border-green-500/30 rounded bg-green-500/5 text-sm"><span class="material-icons text-green-500 text-sm align-middle mr-1">check_circle</span>Using default hours (8 AM - 6 PM, every day). Set custom availability below to override.</div>';
            } else {
                container.innerHTML = slots.map(s => {
                    const dateRange = (s.recurring_start_date && s.recurring_end_date)
                        ? ` <span class="text-xs text-yellow-400 ml-1">${new Date(s.recurring_start_date + 'T00:00:00').toLocaleDateString()} – ${new Date(s.recurring_end_date + 'T00:00:00').toLocaleDateString()}</span>`
                        : '';
                    const label = s.specific_date
                        ? `<span class="font-semibold">${new Date(s.specific_date + 'T00:00:00').toLocaleDateString()}</span> <span class="text-xs text-blue-400 ml-1">(one-time)</span>`
                        : `<span class="font-semibold">${DAY_NAMES[s.day_of_week]}</span> <span class="text-xs text-green-400 ml-1">(recurring)</span>${dateRange}`;
                    return `
                    <div class="flex justify-between items-center p-3 border border-border-dark dark:border-border-light rounded text-sm">
                        <div>
                            ${label}
                            <span class="text-gray-400 dark:text-gray-600 ml-2">${s.start_time} - ${s.end_time}</span>
                            <span class="text-xs text-gray-500 ml-2">(${s.slot_duration_minutes}min slots)</span>
                            ${s.is_active ? '' : '<span class="text-xs text-red-500 ml-2">Inactive</span>'}
                        </div>
                        <button onclick="deleteAvailability(${s.id})" class="text-red-500 hover:text-red-700 text-xs">Remove</button>
                    </div>`;
                }).join('');
            }
        }

        function renderBlockedDatesList() {
            const dates = cachedBlockedDates;
            const container = document.getElementById('blocked-dates-list');
            if (dates.length === 0) {
                container.innerHTML = '<p class="text-gray-400 dark:text-gray-600 text-sm">No blocked dates</p>';
            } else {
                container.innerHTML = dates.map(d => `
                    <div class="flex justify-between items-center p-3 border border-red-500/30 rounded text-sm bg-red-500/5">
                        <div>
                            <span class="font-semibold">${new Date(d.blocked_date + 'T00:00:00').toLocaleDateString()}</span>
                            ${d.reason ? `<span class="text-gray-400 dark:text-gray-600 ml-2">${d.reason}</span>` : ''}
                        </div>
                        <button onclick="unblockDate(${d.id})" class="text-green-500 hover:text-green-700 text-xs">Unblock</button>
                    </div>
                `).join('');
            }
        }

        function renderAppointmentsList() {
            const appts = cachedAppointments || [];
            const container = document.getElementById('appointments-table');
            const upcoming = appts.filter(a => a.status !== 'cancelled' && a.status !== 'completed');
            if (upcoming.length === 0) {
                container.innerHTML = '<p class="text-gray-400 dark:text-gray-600 text-sm">No upcoming appointments</p>';
            } else {
                container.innerHTML = upcoming.map(a => {
                    const statusColors = { pending: 'bg-yellow-500', confirmed: 'bg-green-500', cancelled: 'bg-red-500', completed: 'bg-gray-500', no_show: 'bg-orange-500' };
                    return `
                    <div class="flex justify-between items-center p-3 border border-border-dark dark:border-border-light rounded text-sm">
                        <div>
                            <span class="font-semibold">${new Date(a.appointment_date + 'T00:00:00').toLocaleDateString()}</span>
                            <span class="text-gray-400 dark:text-gray-600 ml-2">${a.start_time} - ${a.end_time}</span>
                            <span class="ml-2">${a.client_name || 'Unknown'} (${a.dog_name || ''})</span>
                            ${a.service_name ? `<span class="text-xs text-gray-500 ml-2">${a.service_name}</span>` : ''}
                            <span class="text-xs px-2 py-0.5 rounded text-white ml-2 ${statusColors[a.status] || 'bg-gray-500'}">${a.status}</span>
                        </div>
                        <div class="flex gap-1">
                            ${a.status === 'pending' ? `<button onclick="updateAppointment(${a.id}, 'confirmed')" class="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-700">Confirm</button>` : ''}
                            ${a.status !== 'cancelled' && a.status !== 'completed' ? `<button onclick="updateAppointment(${a.id}, 'cancelled')" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-700">Cancel</button>` : ''}
                            ${a.status === 'confirmed' ? `<button onclick="updateAppointment(${a.id}, 'completed')" class="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-700">Complete</button>` : ''}
                            ${a.status === 'confirmed' || a.status === 'pending' ? `<button onclick="markNoShow(${a.id})" class="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-700" title="Mark as No Show"><span class="material-icons text-xs">person_off</span></button>` : ''}
                        </div>
                    </div>`;
                }).join('');
            }
        }

        async function updateAppointment(id, status) {
            try {
                const res = await fetch(`${API_BASE}/appointments/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status })
                });
                if (res.ok) {
                    await loadCalendarData();
                    fetchUnreadCount();
                } else {
                    showToast('Failed to update appointment', 'error');
                }
            } catch (error) {
                console.error('Update appointment error:', error);
            }
        }

        // Book Appointment for Client
        let selectedApptSlot = null;

        function toggleApptNonClient() {
            const isNonClient = document.getElementById('appt-nonclient-toggle').checked;
            document.getElementById('appt-client-field').classList.toggle('hidden', isNonClient);
            document.getElementById('appt-nonclient-fields').classList.toggle('hidden', !isNonClient);
            const sel = document.getElementById('appt-client-select');
            if (isNonClient) { sel.removeAttribute('required'); sel.value = ''; } else { sel.setAttribute('required', ''); }
        }

        async function showBookAppointmentModal() {
            selectedApptSlot = null;
            document.getElementById('book-appointment-form').reset();
            document.getElementById('appt-slots-container').classList.add('hidden');
            document.getElementById('appt-slots').innerHTML = '';

            // Set min date to today
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('appt-date').setAttribute('min', today);

            // Populate client dropdown
            const clientSelect = document.getElementById('appt-client-select');
            clientSelect.innerHTML = '<option value="">Select a client...</option>';
            try {
                const res = await fetch(`${API_BASE}/clients`, { headers: getAuthHeaders() });
                const data = await res.json();
                (data.clients || []).forEach(c => {
                    clientSelect.innerHTML += `<option value="${c.id}">${c.client_name || 'Unknown'} ${c.dog_name ? '(' + c.dog_name + ')' : ''}</option>`;
                });
            } catch (e) { console.error('Failed to load clients for appointment:', e); }

            // Populate service dropdown
            const serviceSelect = document.getElementById('appt-service-select');
            serviceSelect.innerHTML = '<option value="">General Training</option>';
            try {
                const res = await fetch(`${API_BASE}/services`, { headers: getAuthHeaders() });
                const data = await res.json();
                (data.services || []).filter(s => s.active).forEach(s => {
                    serviceSelect.innerHTML += `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`;
                });
            } catch (e) { console.error('Failed to load services for appointment:', e); }

            document.getElementById('book-appointment-modal').classList.remove('hidden');
        }

        function closeBookAppointmentModal() {
            document.getElementById('book-appointment-modal').classList.add('hidden');
        }

        // Load available slots and show time inputs when date changes
        let cachedApptDateAppointments = [];
        document.getElementById('appt-date').addEventListener('change', async (e) => {
            const date = e.target.value;
            if (!date) return;
            selectedApptSlot = null;
            document.getElementById('appt-start-time').value = '';
            document.getElementById('appt-end-time').value = '';
            document.getElementById('appt-time-inputs').classList.remove('hidden');

            const slotsContainer = document.getElementById('appt-slots-container');
            const slotsDiv = document.getElementById('appt-slots');
            slotsDiv.innerHTML = '<p class="text-gray-400 text-sm col-span-3">Loading...</p>';
            slotsContainer.classList.remove('hidden');

            // Fetch available slots and existing appointments in parallel
            try {
                const [slotsRes, apptsRes] = await Promise.all([
                    fetch(`${API_BASE}/appointments/available-slots?date=${date}`, { headers: getAuthHeaders() }),
                    fetch(`${API_BASE}/appointments`, { headers: getAuthHeaders() })
                ]);
                const slotsData = await slotsRes.json();
                const apptsData = await apptsRes.json();
                const slots = slotsData.available_slots || [];
                cachedApptDateAppointments = (apptsData.appointments || []).filter(a => a.appointment_date === date && ['pending','confirmed'].includes(a.status));

                if (slots.length === 0) {
                    slotsDiv.innerHTML = '<p class="text-gray-400 text-sm col-span-3">No pre-set slots — use custom time below</p>';
                } else {
                    slotsDiv.innerHTML = slots.map(s => `
                        <button type="button" onclick="selectApptSlot(this, '${s.start_time}', '${s.end_time}')"
                            class="appt-slot-btn border border-border-dark dark:border-border-light rounded px-2 py-1 text-sm hover:bg-teal-500 hover:text-white transition-colors">
                            ${s.start_time} - ${s.end_time}
                        </button>
                    `).join('');
                }
            } catch (e) {
                slotsDiv.innerHTML = '<p class="text-red-400 text-sm col-span-3">Failed to load slots</p>';
            }
        });

        function selectApptSlot(btn, start, end) {
            document.querySelectorAll('.appt-slot-btn').forEach(b => b.classList.remove('bg-teal-500', 'text-white'));
            btn.classList.add('bg-teal-500', 'text-white');
            selectedApptSlot = { start, end };
            document.getElementById('appt-start-time').value = start;
            document.getElementById('appt-end-time').value = end;
        }

        document.getElementById('book-appointment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const isNonClient = document.getElementById('appt-nonclient-toggle').checked;

            const startTime = document.getElementById('appt-start-time').value;
            const endTime = document.getElementById('appt-end-time').value;
            if (!startTime || !endTime) { showToast('Please select or enter a start and end time', 'error'); return; }
            if (endTime <= startTime) { showToast('End time must be after start time', 'error'); return; }

            const apptDate = document.getElementById('appt-date').value;
            if (!apptDate) { showToast('Please select a date', 'error'); return; }

            const serviceSelect = document.getElementById('appt-service-select');
            const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
            const serviceName = serviceSelect.value ? selectedOption.dataset.name : 'General Training';
            const notes = document.getElementById('appt-notes').value || '';

            const submitBtn = document.getElementById('appt-submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Booking...';

            if (isNonClient) {
                // Non-client: send appointment email only (no DB storage)
                const ncName = document.getElementById('appt-nonclient-name').value;
                const ncEmail = document.getElementById('appt-nonclient-email').value;
                if (!ncName || !ncEmail) { showToast('Please enter name and email', 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Book Appointment'; return; }

                try {
                    const res = await fetch(`${API_BASE}/email/send-content`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                            to: ncEmail,
                            subject: `Appointment Scheduled - ${apptDate} - K9 Vision`,
                            content_type: 'appointment',
                            title: `Appointment for ${ncName}`,
                            content_body: `Date: ${new Date(apptDate + 'T00:00:00').toLocaleDateString()}\nTime: ${startTime} - ${endTime}\nService: ${serviceName}${notes ? '\nNotes: ' + notes : ''}\n\nTo confirm, reschedule, or cancel, please reply to this email or contact us at trainercg@k9visiontx.com or visit k9visiontx.com/contact`
                        })
                    });
                    if (res.ok) { showToast('Appointment email sent!', 'success'); closeBookAppointmentModal(); }
                    else { const d = await res.json(); showToast(d.error || 'Failed to send', 'error'); }
                } catch (error) { console.error('Non-client appointment error:', error); showToast('Failed to send', 'error'); }
                submitBtn.disabled = false;
                submitBtn.textContent = 'Book Appointment';
                return;
            }

            // Client appointment: normal flow
            const clientId = document.getElementById('appt-client-select').value;
            if (!clientId) { showToast('Please select a client', 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Book Appointment'; return; }

            // Check for conflicts with existing appointments
            const conflict = cachedApptDateAppointments.find(a => startTime < a.end_time && endTime > a.start_time);
            if (conflict) {
                const proceed = confirm(`Scheduling conflict: There is an existing appointment at ${conflict.start_time} - ${conflict.end_time} with ${conflict.client_name || 'a client'}.\n\nBook anyway?`);
                if (!proceed) { submitBtn.disabled = false; submitBtn.textContent = 'Book Appointment'; return; }
            }

            try {
                const res = await fetch(`${API_BASE}/appointments`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        client_id: parseInt(clientId),
                        appointment_date: apptDate,
                        start_time: startTime,
                        end_time: endTime,
                        service_id: serviceSelect.value ? parseInt(serviceSelect.value) : null,
                        service_name: serviceName,
                        notes: notes || null,
                        admin_override: true
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Appointment booked! Client will be notified to confirm.', 'success');
                    closeBookAppointmentModal();
                    await loadCalendarData();
                    fetchUnreadCount();
                } else {
                    showToast(data.error || 'Failed to book appointment', 'error');
                }
            } catch (error) {
                console.error('Book appointment error:', error);
                showToast('Failed to book appointment', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Book Appointment';
            }
        });

        // Calendar Settings
        function openCalendarSettings() {
            document.getElementById('calendar-settings-modal').classList.remove('hidden');
            checkGoogleCalendarStatus();
        }

        function closeCalendarSettings() {
            document.getElementById('calendar-settings-modal').classList.add('hidden');
        }

        async function checkGoogleCalendarStatus() {
            try {
                const resp = await fetch(`${API_BASE}/calendar/google/status`, {
                    headers: getAuthHeaders()
                });
                const data = await resp.json();
                if (data.connected) {
                    document.getElementById('gcal-connected').classList.remove('hidden');
                    document.getElementById('gcal-disconnected').classList.add('hidden');
                } else {
                    document.getElementById('gcal-disconnected').classList.remove('hidden');
                    document.getElementById('gcal-connected').classList.add('hidden');
                }
            } catch (err) {
                console.error('Failed to check Google Calendar status:', err);
                document.getElementById('gcal-disconnected').classList.remove('hidden');
                document.getElementById('gcal-connected').classList.add('hidden');
            }
        }

        async function connectGoogleCalendar() {
            try {
                const resp = await fetch(`${API_BASE}/calendar/google/auth-url`, {
                    headers: getAuthHeaders()
                });
                const data = await resp.json();
                if (data.url) {
                    window.location.href = data.url;
                }
            } catch (err) {
                console.error('Failed to get Google auth URL:', err);
                showToast('Failed to connect Google Calendar', 'error');
            }
        }

        async function disconnectGoogleCalendar() {
            showConfirmModal('Disconnect Google Calendar', 'Disconnect Google Calendar? Synced events will no longer update.', async () => {
                try {
                    await fetch(`${API_BASE}/calendar/google/disconnect`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    document.getElementById('gcal-connected').classList.add('hidden');
                    document.getElementById('gcal-disconnected').classList.remove('hidden');
                    showToast('Google Calendar disconnected', 'success');
                } catch (err) {
                    console.error('Failed to disconnect:', err);
                    showToast('Failed to disconnect', 'error');
                }
            }, 'Disconnect');
        }

        async function generateIcalFeed() {
            try {
                const resp = await fetch(`${API_BASE}/calendar/feed/generate`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                const data = await resp.json();
                if (data.feed_url) {
                    document.getElementById('ical-url-input').value = data.feed_url;
                    document.getElementById('ical-feed-url').classList.remove('hidden');
                    document.getElementById('ical-generate-btn').textContent = 'Refresh Feed URL';
                }
            } catch (err) {
                console.error('Failed to generate iCal feed:', err);
                showToast('Failed to generate feed URL', 'error');
            }
        }

        function copyIcalUrl() {
            const input = document.getElementById('ical-url-input');
            navigator.clipboard.writeText(input.value).then(() => {
                showToast('Feed URL copied to clipboard!', 'success');
            });
        }

        // Check for Google Calendar connection callback
        const gcalParams = new URLSearchParams(window.location.search);
        if (gcalParams.get('gcal') === 'connected') {
            showToast('Google Calendar connected successfully!', 'success');
            window.history.replaceState({}, '', window.location.pathname);
        }

        // Review Request Functions
        let reviewClientsLoaded = false;
        async function showReviewRequestModal() {
            document.getElementById('review-request-form').reset();

            if (!reviewClientsLoaded) {
                const clientSelect = document.getElementById('review-client-select');
                clientSelect.innerHTML = '<option value="">-- Or type email below --</option>';
                try {
                    const res = await fetch(`${API_BASE}/clients`, { headers: getAuthHeaders() });
                    const data = await res.json();
                    (data.clients || []).forEach(c => {
                        const email = c.email || '';
                        clientSelect.innerHTML += `<option value="${c.id}" data-email="${email}">${c.client_name || 'Unknown'} ${c.dog_name ? '(' + c.dog_name + ')' : ''} ${email ? '- ' + email : ''}</option>`;
                    });
                    reviewClientsLoaded = true;
                } catch (e) { console.error('Failed to load clients for review:', e); }
            }
            document.getElementById('review-request-modal').classList.remove('hidden');
        }

        function closeReviewRequestModal() {
            document.getElementById('review-request-modal').classList.add('hidden');
        }

        function fillReviewEmail() {
            const select = document.getElementById('review-client-select');
            const opt = select.options[select.selectedIndex];
            if (opt && opt.dataset.email) {
                document.getElementById('review-email').value = opt.dataset.email;
            }
        }

        document.getElementById('review-request-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('review-email').value;
            const clientId = document.getElementById('review-client-select').value;
            if (!email) { showToast('Please enter an email address', 'error'); return; }

            const btn = document.getElementById('review-request-btn');
            btn.disabled = true;
            btn.textContent = 'Sending...';

            try {
                const res = await fetch(`${API_BASE}/reviews/request`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ email, client_id: clientId ? parseInt(clientId) : null })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Review request sent!', 'success');
                    closeReviewRequestModal();
                } else {
                    showToast(data.error || 'Failed to send review request', 'error');
                }
            } catch (error) {
                console.error('Review request error:', error);
                showToast('Failed to send review request', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Request';
            }
        });

        // Reviews Management
        function showReviewsSection() {
            showSection('reviews-section');
            loadReviews('pending');
        }

        // --- Contacts Management ---
        let allContacts = [];

        function showContacts() {
            showSection('contacts-section');
            loadContacts();
        }

        async function loadContacts(search) {
            try {
                let url = `${API_BASE}/contacts`;
                if (search) url += `?search=${encodeURIComponent(search)}`;
                const res = await fetch(url, { headers: getAuthHeaders() });
                const data = await res.json();
                allContacts = data.contacts || [];
                renderContacts(allContacts);
            } catch (e) { console.error('Load contacts error:', e); }
        }

        function searchContacts() {
            const q = document.getElementById('contacts-search').value.trim();
            loadContacts(q || undefined);
        }

        function renderContacts(contacts) {
            const tbody = document.getElementById('contacts-table-body');
            if (!contacts || contacts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-gray-400 dark:text-gray-600 text-center">No contacts found</td></tr>';
                return;
            }
            const sourceColors = { contact_form: 'bg-blue-500', manual: 'bg-gray-500', invoice: 'bg-pink-500' };
            tbody.innerHTML = contacts.map(c => `
                <tr class="border-b border-border-dark dark:border-border-light">
                    <td class="py-2 font-medium">${c.name}</td>
                    <td class="py-2 text-gray-400 dark:text-gray-600">${c.email || '—'}</td>
                    <td class="py-2 text-gray-400 dark:text-gray-600 hidden sm:table-cell">${c.phone || '—'}</td>
                    <td class="py-2 text-gray-400 dark:text-gray-600 hidden sm:table-cell">${c.dog_name || '—'}</td>
                    <td class="py-2 hidden md:table-cell"><span class="text-xs ${sourceColors[c.source] || 'bg-gray-500'} text-white px-2 py-0.5 rounded">${c.source}</span></td>
                    <td class="py-2">
                        <div class="flex gap-1">
                            <button onclick="editContact(${c.id})" class="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-blue-700">Edit</button>
                            <button onclick="convertContactToClient(${c.id})" class="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-700" title="Convert to client">Client</button>
                            <button onclick="deleteContact(${c.id})" class="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-700">Del</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        function showAddContactModal() {
            document.getElementById('contact-modal-title').textContent = 'Add Contact';
            document.getElementById('contact-edit-id').value = '';
            document.getElementById('contact-name').value = '';
            document.getElementById('contact-email').value = '';
            document.getElementById('contact-phone').value = '';
            document.getElementById('contact-dog').value = '';
            document.getElementById('contact-notes').value = '';
            document.getElementById('contact-modal').classList.remove('hidden');
        }

        function editContact(id) {
            const c = allContacts.find(x => x.id === id);
            if (!c) return;
            document.getElementById('contact-modal-title').textContent = 'Edit Contact';
            document.getElementById('contact-edit-id').value = id;
            document.getElementById('contact-name').value = c.name || '';
            document.getElementById('contact-email').value = c.email || '';
            document.getElementById('contact-phone').value = c.phone || '';
            document.getElementById('contact-dog').value = c.dog_name || '';
            document.getElementById('contact-notes').value = c.notes || '';
            document.getElementById('contact-modal').classList.remove('hidden');
        }

        async function saveContact() {
            const id = document.getElementById('contact-edit-id').value;
            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const phone = document.getElementById('contact-phone').value.trim();
            const dog_name = document.getElementById('contact-dog').value.trim();
            const notes = document.getElementById('contact-notes').value.trim();

            if (!name) { showToast('Name is required', 'error'); return; }

            try {
                const method = id ? 'PUT' : 'POST';
                const url = id ? `${API_BASE}/contacts/${id}` : `${API_BASE}/contacts`;
                const res = await fetch(url, {
                    method,
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, dog_name, notes })
                });
                if (res.ok) {
                    showToast(id ? 'Contact updated' : 'Contact added', 'success');
                    document.getElementById('contact-modal').classList.add('hidden');
                    loadContacts();
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Failed to save contact', 'error');
                }
            } catch (e) { showToast('Failed to save contact', 'error'); }
        }

        async function deleteContact(id) {
            if (!confirm('Delete this contact?')) return;
            try {
                const res = await fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                if (res.ok) { showToast('Contact deleted'); loadContacts(); }
                else showToast('Failed to delete', 'error');
            } catch (e) { showToast('Failed to delete', 'error'); }
        }

        async function convertContactToClient(contactId) {
            const c = allContacts.find(x => x.id === contactId);
            if (!c) return;
            if (!c.email) { showToast('Contact needs an email to convert to client', 'error'); return; }
            if (!confirm(`Convert "${c.name}" to a full client? This will create a user account and send welcome credentials.`)) return;
            try {
                const res = await fetch(`${API_BASE}/clients/create-with-email`, {
                    method: 'POST',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_name: c.name,
                        email: c.email,
                        dog_name: c.dog_name || ''
                    })
                });
                if (res.ok) {
                    showToast('Contact converted to client! Credentials sent.', 'success');
                    await deleteContact(contactId);
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Failed to convert contact', 'error');
                }
            } catch (e) { showToast('Failed to convert contact', 'error'); }
        }

        // --- Reports Dashboard ---
        let reportCharts = {};
        let reportData = null;

        function showReports() {
            showSection('reports-section');
            loadReports();
        }

        function resetReportDates() {
            document.getElementById('report-start-date').value = '';
            document.getElementById('report-end-date').value = '';
            loadReports();
        }

        async function loadReports() {
            const startDate = document.getElementById('report-start-date').value;
            const endDate = document.getElementById('report-end-date').value;
            try {
                let statsUrl = `${API_BASE}/stats/extended`;
                const params = [];
                if (startDate) params.push(`startDate=${startDate}`);
                if (endDate) params.push(`endDate=${endDate}`);
                if (params.length) statsUrl += '?' + params.join('&');
                const res = await fetch(statsUrl, { headers: getAuthHeaders() });
                reportData = await res.json();
                if (!reportData.success) { showToast('Failed to load reports', 'error'); return; }

                // Summary cards
                document.getElementById('report-outstanding').textContent = '$' + Number(reportData.outstandingBalance).toFixed(2);
                const totalSold = (reportData.servicePopularity || []).reduce((s, r) => s + r.count, 0);
                document.getElementById('report-total-services').textContent = totalSold;
                const topService = reportData.servicePopularity?.[0];
                document.getElementById('report-top-service').textContent = topService ? topService.service_name : '—';
                const paidCount = (reportData.revenueByMonth || []).reduce((s, r) => s + r.count, 0);
                document.getElementById('report-paid-count').textContent = paidCount;

                renderReportCharts(reportData);
            } catch (e) { console.error('Load reports error:', e); }

            // Appointment analytics
            const apptParams = [];
            if (startDate) apptParams.push(`startDate=${startDate}`);
            if (endDate) apptParams.push(`endDate=${endDate}`);
            let apptUrl = `${API_BASE}/stats/appointments`;
            if (apptParams.length) apptUrl += '?' + apptParams.join('&');
            try {
                const apptRes = await fetch(apptUrl, { headers: getAuthHeaders() });
                const apptData = await apptRes.json();
                if (apptData.success) renderAppointmentCharts(apptData);
            } catch (e) { console.error('Appointment stats error:', e); }
        }

        function renderReportCharts(data) {
            // Destroy existing charts
            Object.values(reportCharts).forEach(c => c.destroy());
            reportCharts = {};

            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#9CA3AF' : '#6B7280';
            const gridColor = isDark ? '#1F2937' : '#E5E7EB';

            const chartDefaults = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: textColor, font: { size: 11 } } } },
                scales: {
                    x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }
                }
            };

            // Revenue line chart
            const revMonths = (data.revenueByMonth || []).map(r => r.month);
            const revAmounts = (data.revenueByMonth || []).map(r => r.revenue);
            reportCharts.revenue = new Chart(document.getElementById('revenue-chart'), {
                type: 'line',
                data: {
                    labels: revMonths,
                    datasets: [{ label: 'Revenue ($)', data: revAmounts, borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 }]
                },
                options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
            });

            // Invoice status doughnut
            const statuses = (data.invoiceStatus || []);
            const statusColors = { paid: '#22C55E', pending: '#F59E0B', overdue: '#EF4444', cancelled: '#6B7280' };
            reportCharts.invoiceStatus = new Chart(document.getElementById('invoice-status-chart'), {
                type: 'doughnut',
                data: {
                    labels: statuses.map(s => s.status),
                    datasets: [{ data: statuses.map(s => s.count), backgroundColor: statuses.map(s => statusColors[s.status] || '#6B7280') }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 } } } } }
            });

            // Service popularity bar chart
            const services = (data.servicePopularity || []).slice(0, 8);
            reportCharts.services = new Chart(document.getElementById('service-chart'), {
                type: 'bar',
                data: {
                    labels: services.map(s => s.service_name.length > 15 ? s.service_name.slice(0, 15) + '...' : s.service_name),
                    datasets: [{ label: 'Times Sold', data: services.map(s => s.count), backgroundColor: '#8B5CF6' }]
                },
                options: { ...chartDefaults, indexAxis: 'y', plugins: { ...chartDefaults.plugins, legend: { display: false } } }
            });

            // Client growth line chart
            const growthMonths = (data.clientGrowth || []).map(r => r.month);
            const growthCounts = (data.clientGrowth || []).map(r => r.new_clients);
            reportCharts.clientGrowth = new Chart(document.getElementById('client-growth-chart'), {
                type: 'bar',
                data: {
                    labels: growthMonths,
                    datasets: [{ label: 'New Clients', data: growthCounts, backgroundColor: '#10B981' }]
                },
                options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
            });
        }

        let apptStatusChart, apptVolumeChart;
        function renderAppointmentCharts(data) {
            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#374151' : '#d1d5db';
            const gridColor = isDark ? '#e5e7eb' : '#374151';

            // Rates
            document.getElementById('stat-completion-rate').textContent = data.rates.completionRate + '%';
            document.getElementById('stat-cancellation-rate').textContent = data.rates.cancellationRate + '%';
            document.getElementById('stat-noshow-rate').textContent = data.rates.noShowRate + '%';

            // Status doughnut
            const statusData = data.statusBreakdown || [];
            const statusColors = { pending: '#EAB308', confirmed: '#3B82F6', completed: '#22C55E', cancelled: '#EF4444', no_show: '#F97316' };
            if (apptStatusChart) apptStatusChart.destroy();
            const ctx1 = document.getElementById('appt-status-chart');
            if (ctx1) {
                apptStatusChart = new Chart(ctx1, {
                    type: 'doughnut',
                    data: {
                        labels: statusData.map(s => s.status.charAt(0).toUpperCase() + s.status.slice(1).replace('_', ' ')),
                        datasets: [{ data: statusData.map(s => s.count), backgroundColor: statusData.map(s => statusColors[s.status] || '#6B7280') }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } } }
                });
            }

            // Monthly volume bar
            const volume = data.monthlyVolume || [];
            if (apptVolumeChart) apptVolumeChart.destroy();
            const ctx2 = document.getElementById('appt-volume-chart');
            if (ctx2) {
                apptVolumeChart = new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: volume.map(v => v.month),
                        datasets: [{ label: 'Appointments', data: volume.map(v => v.count), backgroundColor: '#8B5CF6' }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: textColor }, grid: { color: gridColor } }, y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true } }, plugins: { legend: { labels: { color: textColor } } } }
                });
            }
        }

        function exportReportsCSV() {
            if (!reportData) { showToast('Load reports first', 'error'); return; }
            let csv = 'Month,Revenue,Paid Invoices\n';
            (reportData.revenueByMonth || []).forEach(r => {
                csv += `${r.month},${r.revenue},${r.count}\n`;
            });
            csv += '\nService,Times Sold,Revenue\n';
            (reportData.servicePopularity || []).forEach(s => {
                csv += `"${s.service_name}",${s.count},${s.revenue}\n`;
            });
            csv += '\nInvoice Status,Count,Total\n';
            (reportData.invoiceStatus || []).forEach(s => {
                csv += `${s.status},${s.count},${s.total}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `K9Vision_Report_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }

        async function loadReviews(status) {
            const container = document.getElementById('reviews-list');
            container.innerHTML = '<p class="text-gray-400 text-sm">Loading...</p>';

            try {
                const url = status ? `${API_BASE}/reviews?status=${status}` : `${API_BASE}/reviews`;
                const res = await fetch(url, { headers: getAuthHeaders() });
                const data = await res.json();
                const reviews = data.reviews || [];

                if (reviews.length === 0) {
                    container.innerHTML = '<p class="text-gray-400 text-sm">No reviews found</p>';
                    return;
                }

                const statusColors = { pending: 'bg-yellow-500', approved: 'bg-green-500', rejected: 'bg-red-500' };
                container.innerHTML = reviews.map(r => {
                    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
                    return `
                    <div class="p-4 border border-border-dark dark:border-border-light rounded">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <span class="font-semibold">${r.reviewer_name}</span>
                                ${r.reviewer_email ? `<span class="text-xs text-gray-500 ml-2">${r.reviewer_email}</span>` : ''}
                                <div class="text-yellow-400 text-lg">${stars}</div>
                            </div>
                            <span class="text-xs px-2 py-0.5 rounded text-white ${statusColors[r.status] || 'bg-gray-500'}">${r.status}</span>
                        </div>
                        <p class="text-sm text-gray-300 dark:text-gray-600 mb-3">"${r.content}"</p>
                        <div class="flex gap-2 items-center">
                            <span class="text-xs text-gray-500">${new Date(r.created_at).toLocaleDateString()}</span>
                            ${r.status !== 'approved' ? `<button onclick="updateReviewStatus(${r.id}, 'approved')" class="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-700">Approve</button>` : ''}
                            ${r.status !== 'rejected' ? `<button onclick="updateReviewStatus(${r.id}, 'rejected')" class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-700">Reject</button>` : ''}
                            ${r.status !== 'pending' ? `<button onclick="updateReviewStatus(${r.id}, 'pending')" class="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700">Pending</button>` : ''}
                        </div>
                    </div>`;
                }).join('');
            } catch (error) {
                console.error('Load reviews error:', error);
                container.innerHTML = '<p class="text-red-400 text-sm">Failed to load reviews</p>';
            }
        }

        async function updateReviewStatus(reviewId, status) {
            try {
                const res = await fetch(`${API_BASE}/reviews`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ id: reviewId, status })
                });
                if (res.ok) {
                    showToast(`Review ${status}!`, 'success');
                    loadReviews();
                } else {
                    showToast('Failed to update review', 'error');
                }
            } catch (error) {
                console.error('Update review error:', error);
            }
        }

        async function previewEmail(template, params) {
            const iframe = document.getElementById('email-preview-iframe');
            document.getElementById('email-preview-modal').classList.remove('hidden');
            iframe.srcdoc = '<p style="padding:20px;color:#888;">Loading preview...</p>';
            try {
                const paramsStr = encodeURIComponent(JSON.stringify(params || {}));
                const res = await fetch(`${API_BASE}/email/preview?template=${template}&params=${paramsStr}`, {
                    headers: getAuthHeaders()
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    iframe.srcdoc = `<p style="padding:20px;color:red;">Failed to load preview: ${err.error || res.statusText}</p>`;
                    return;
                }
                const html = await res.text();
                iframe.srcdoc = html;
            } catch (e) {
                iframe.srcdoc = '<p style="padding:20px;color:red;">Failed to load preview</p>';
            }
        }
        function closeEmailPreview() {
            document.getElementById('email-preview-modal').classList.add('hidden');
            document.getElementById('email-preview-iframe').srcdoc = '';
        }

        async function previewInvoiceEmail(invoiceId) {
            if (!invoiceId) { showToast('No invoice selected', 'error'); return; }
            try {
                const res = await fetch(`${API_BASE}/invoices/${invoiceId}`, { headers: getAuthHeaders() });
                const data = await res.json();
                if (!data.success) { previewEmail('invoiceEmail', {}); return; }
                const inv = data.invoice;
                const items = inv.items || [];
                previewEmail('invoiceEmail', {
                    invoice: {
                        invoice_number: inv.invoice_number, client_name: inv.client_name || inv.recipient_name || '',
                        dog_name: inv.dog_name || '', trainer_name: inv.trainer_name,
                        date: inv.date, due_date: inv.due_date,
                        subtotal: inv.subtotal, tax_rate: inv.tax_rate, tax_amount: inv.tax_amount, total: inv.total,
                        discount_amount: inv.discount_amount, notes: inv.notes
                    },
                    items: items.map(i => ({
                        service_name: i.service_name, quantity: i.quantity, price: i.price,
                        total: i.total, due_date: i.due_date, amount_paid: i.amount_paid
                    }))
                });
            } catch (e) { previewEmail('invoiceEmail', {}); }
        }

        async function markNoShow(id) {
            if (!confirm('Mark this appointment as no-show?')) return;
            try {
                const res = await fetch(`${API_BASE}/appointments/${id}`, {
                    method: 'PUT',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'no_show' })
                });
                if (res.ok) {
                    showToast('Marked as no-show', 'success');
                    await loadCalendarData();
                    fetchUnreadCount();
                } else {
                    showToast('Failed to update', 'error');
                }
            } catch (e) { showToast('Failed to update', 'error'); }
        }

        // --- CSV Import Functions (Bulk Contact Import) ---
        let csvParsedData = [];

        function showCSVImportModal() {
            csvParsedData = [];
            document.getElementById('csv-file-input').value = '';
            document.getElementById('csv-preview').classList.add('hidden');
            document.getElementById('csv-import-results').classList.add('hidden');
            document.getElementById('csv-import-modal').classList.remove('hidden');
        }
        function closeCSVImportModal() {
            document.getElementById('csv-import-modal').classList.add('hidden');
        }

        function parseCSV(text) {
            const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            const result = [];
            for (const line of lines) {
                if (!line.trim()) continue;
                const row = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (inQuotes) {
                        if (ch === '"' && line[i+1] === '"') { current += '"'; i++; }
                        else if (ch === '"') inQuotes = false;
                        else current += ch;
                    } else {
                        if (ch === '"') inQuotes = true;
                        else if (ch === ',') { row.push(current.trim()); current = ''; }
                        else current += ch;
                    }
                }
                row.push(current.trim());
                result.push(row);
            }
            return result;
        }

        function handleCSVFile(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                let text = e.target.result;
                // Remove BOM if present
                if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
                const rows = parseCSV(text);
                if (rows.length < 2) { showToast('CSV must have a header row and at least one data row', 'error'); return; }
                const headers = rows[0];
                const dataRows = rows.slice(1).filter(r => r.some(cell => cell));

                // Auto-map columns by header name
                const colMap = { name: -1, email: -1, phone: -1, dog_name: -1, notes: -1 };
                headers.forEach((h, i) => {
                    const lh = h.toLowerCase().replace(/[^a-z]/g, '');
                    if (lh.includes('name') && !lh.includes('dog') && colMap.name === -1) colMap.name = i;
                    else if (lh.includes('email')) colMap.email = i;
                    else if (lh.includes('phone') || lh.includes('tel')) colMap.phone = i;
                    else if (lh.includes('dog')) colMap.dog_name = i;
                    else if (lh.includes('note') || lh.includes('comment')) colMap.notes = i;
                });

                csvParsedData = dataRows.map(row => ({
                    name: colMap.name >= 0 ? row[colMap.name] || '' : '',
                    email: colMap.email >= 0 ? row[colMap.email] || '' : '',
                    phone: colMap.phone >= 0 ? row[colMap.phone] || '' : '',
                    dog_name: colMap.dog_name >= 0 ? row[colMap.dog_name] || '' : '',
                    notes: colMap.notes >= 0 ? row[colMap.notes] || '' : ''
                }));

                document.getElementById('csv-row-count').textContent = csvParsedData.length;
                const headerHtml = '<tr>' + ['Name', 'Email', 'Phone', 'Dog Name', 'Notes'].map(h =>
                    `<th class="border border-gray-600 dark:border-gray-300 px-2 py-1 text-left">${h}</th>`
                ).join('') + '</tr>';
                document.getElementById('csv-preview-header').innerHTML = headerHtml;
                const bodyHtml = csvParsedData.slice(0, 10).map(c =>
                    '<tr>' + [c.name, c.email, c.phone, c.dog_name, c.notes].map(v =>
                        `<td class="border border-gray-700 dark:border-gray-300 px-2 py-1 text-sm">${v || ''}</td>`
                    ).join('') + '</tr>'
                ).join('') + (csvParsedData.length > 10 ? `<tr><td colspan="5" class="text-center text-sm text-gray-500 py-2">...and ${csvParsedData.length - 10} more rows</td></tr>` : '');
                document.getElementById('csv-preview-body').innerHTML = bodyHtml;
                document.getElementById('csv-preview').classList.remove('hidden');
            };
            reader.readAsText(file);
        }

        async function importCSVContacts() {
            if (csvParsedData.length === 0) return showToast('No data to import', 'error');
            const btn = document.getElementById('csv-import-btn');
            btn.disabled = true; btn.textContent = 'Importing...';
            try {
                const res = await fetch(`${API_BASE}/contacts/bulk`, {
                    method: 'POST',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contacts: csvParsedData })
                });
                const data = await res.json();
                const resultsEl = document.getElementById('csv-import-results');
                if (data.success) {
                    resultsEl.innerHTML = `<div class="bg-green-900 dark:bg-green-100 text-green-300 dark:text-green-800 p-3 rounded">
                        <p class="font-semibold">Imported ${data.imported} contact(s)!</p>
                        ${data.errors && data.errors.length > 0 ? `<p class="text-sm mt-1">${data.errors.length} row(s) skipped (missing name)</p>` : ''}
                    </div>`;
                    resultsEl.classList.remove('hidden');
                    showToast(`Imported ${data.imported} contacts`, 'success');
                    if (typeof loadContacts === 'function') loadContacts();
                } else {
                    resultsEl.innerHTML = `<div class="bg-red-900 dark:bg-red-100 text-red-300 dark:text-red-800 p-3 rounded"><p>${data.error || 'Import failed'}</p></div>`;
                    resultsEl.classList.remove('hidden');
                }
            } catch (e) { showToast('Import failed', 'error'); }
            btn.disabled = false; btn.textContent = 'Import';
        }

        // --- Admin Media Album Filter / Sort / Reorder ---
        let adminMediaReorderMode = false;
        let adminSortableInstance = null;

        function filterAdminMediaByAlbum() {
            const filter = document.getElementById('admin-media-album-filter').value;
            const allMedia = window.currentDetailMedia || [];
            if (filter === 'all') {
                renderAdminMedia(allMedia);
            } else {
                renderAdminMedia(allMedia.filter(m => m.type === filter));
            }
        }

        function sortAdminMedia() {
            const sortBy = document.getElementById('admin-media-sort').value;
            const allMedia = [...(window.currentDetailMedia || [])];
            if (sortBy === 'newest') {
                allMedia.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
            } else if (sortBy === 'oldest') {
                allMedia.sort((a, b) => new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0));
            } else if (sortBy === 'name') {
                allMedia.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
            }
            window.currentDetailMedia = allMedia;
            filterAdminMediaByAlbum();
        }

        function toggleAdminMediaReorder() {
            adminMediaReorderMode = !adminMediaReorderMode;
            const btn = document.getElementById('admin-media-reorder-toggle');
            const mediaEl = document.getElementById('detail-media');

            if (adminMediaReorderMode) {
                btn.textContent = 'Done';
                btn.classList.remove('bg-indigo-600');
                btn.classList.add('bg-green-600');
                if (typeof Sortable !== 'undefined') {
                    adminSortableInstance = Sortable.create(mediaEl, {
                        animation: 150,
                        ghostClass: 'opacity-50',
                        onEnd: function(evt) {
                            const media = window.currentDetailMedia || [];
                            if (media.length > 0) {
                                const movedItem = media.splice(evt.oldIndex, 1)[0];
                                media.splice(evt.newIndex, 0, movedItem);
                                window.currentDetailMedia = media;
                            }
                        }
                    });
                }
                showToast('Drag items to reorder');
            } else {
                btn.textContent = 'Reorder';
                btn.classList.remove('bg-green-600');
                btn.classList.add('bg-indigo-600');
                if (adminSortableInstance) {
                    adminSortableInstance.destroy();
                    adminSortableInstance = null;
                }
                // Persist reorder to server
                const media = window.currentDetailMedia || [];
                const orderedIds = media.map(m => m.id);
                if (orderedIds.length > 0 && currentDetailClientId) {
                    fetch(`${API_BASE}/media/reorder`, {
                        method: 'POST',
                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ client_id: currentDetailClientId, media_ids: orderedIds })
                    }).catch(() => {});
                }
                renderAdminMedia(media);
            }
        }

        loadDashboard();
        fetchUnreadCount();
