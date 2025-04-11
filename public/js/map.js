let map;
let markers = [];
let postModal;

document.addEventListener('DOMContentLoaded', () => {
    postModal = new bootstrap.Modal(document.getElementById('postModal'));
    initMap();
    loadPosts();
    document.getElementById('postForm').addEventListener('submit', createPost);
    document.getElementById('searchForm').addEventListener('submit', searchLocation);
});

function initMap() {
    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.on('click', function(e) {
        document.getElementById('lat').value = e.latlng.lat;
        document.getElementById('lng').value = e.latlng.lng;
        postModal.show();
    });
    window.addEventListener('resize', function() {
        map.invalidateSize();
    });
}

async function loadPosts() {
    try {
        showMapLoading(true);
        const response = await fetch('/posts');
        if (!response.ok) throw new Error('Failed to fetch posts');
        
        const posts = await response.json();
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
        posts.forEach(post => addMarker(post));
        showMapLoading(false);
    } catch (error) {
        console.error('Error loading posts:', error);
        showMapLoading(false);
        showMessage('error', 'Không thể tải dữ liệu bài đăng');
    }
}

function addMarker(post) {
    if (!post.location || !post.location.coordinates) return;
    
    const lng = post.location.coordinates[0];
    const lat = post.location.coordinates[1];
    
    const markerIcon = L.divIcon({
        className: post.isPending ? 'custom-marker pending' : 'custom-marker approved',
        html: `<i class="fas fa-map-marker-alt ${post.isPending ? 'text-warning' : 'text-primary'}"></i>`,
        iconSize: [24, 32],
        iconAnchor: [12, 32],
        popupAnchor: [0, -32]
    });
    
    const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
    
    let popupContent = `
        <div class="popup-content">
            <div class="popup-header">${post.title}</div>
            <div class="popup-body">
                <div class="post-content">${post.content}</div>
    `;
    
    if (post.image) {
        popupContent += `
                <div class="image-container mt-3 mb-3">
                    <img src="${post.image}" alt="${post.title}" class="story-image">
                </div>
        `;
    }
    
    if (window.isAdmin) {
        popupContent += `
                <div class="post-status mt-2">
                    <span class="badge ${post.isPending ? 'bg-warning text-dark' : 'bg-success'}">
                        ${post.isPending ? 'Chờ duyệt' : 'Đã duyệt'}
                    </span>
                </div>
        `;
    }
    
    popupContent += `
            </div>
            <div class="popup-footer">
                <div class="post-author">
                    <div class="author-icon"><i class="fas fa-user"></i></div>
                    <span>${post.author?.username || 'Anonymous'}</span>
                </div>
                <div class="post-date">${formatDate(post.createdAt)}</div>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
    });
    
    markers.push(marker);
}

async function createPost(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Đang xử lý...';
        submitBtn.disabled = true;
        
        const response = await fetch('/posts/create', {
            method: 'POST',
            body: formData
        });
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to create post');
        }
        
        const result = await response.json();
        postModal.hide();
        e.target.reset();
        showMessage('success', result.message || 'Câu chuyện của bạn đã được gửi và đang chờ duyệt.');
        if (window.isAdmin) {
            loadPosts();
        }
    } catch (error) {
        console.error('Error creating post:', error);
        showMessage('error', `Lỗi: ${error.message}`);
    }
}

async function searchLocation(e) {
    e.preventDefault();
    const query = document.getElementById('searchQuery').value.trim();
    
    if (!query) {
        alert('Vui lòng nhập địa điểm để tìm kiếm');
        return;
    }
    
    try {
        document.querySelector('#searchForm button').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        document.querySelector('#searchForm button').innerHTML = '<i class="fas fa-search"></i>';
        
        if (data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            map.setView([lat, lon], 13);
            
            const pulsingIcon = L.divIcon({
                className: 'pulsing-marker',
                html: '<i class="fas fa-map-marker-alt text-danger"></i>',
                iconSize: [30, 40],
                iconAnchor: [15, 40]
            });
            
            const marker = L.marker([lat, lon], { icon: pulsingIcon })
                .addTo(map)
                .bindPopup(`<div class="search-result"><strong>${result.display_name}</strong></div>`)
                .openPopup();
            
            setTimeout(() => {
                map.removeLayer(marker);
            }, 10000);
        } else {
            showMessage('warning', 'Không tìm thấy địa điểm. Vui lòng thử từ khóa khác.');
        }
    } catch (error) {
        console.error('Error searching location:', error);
        document.querySelector('#searchForm button').innerHTML = '<i class="fas fa-search"></i>';
        showMessage('error', 'Tìm kiếm thất bại. Vui lòng thử lại.');
    }
}

function showMessage(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'danger'} alert-dismissible fade show fixed-top mx-auto my-3`;
    alertDiv.style.maxWidth = '500px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.zIndex = '9999';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(alertDiv);
    setTimeout(() => {
        const dismissButton = alertDiv.querySelector('.btn-close');
        if (dismissButton) {
            dismissButton.click();
        }
    }, 5000);
}

function showMapLoading(isLoading) {
    const existingLoader = document.getElementById('map-loading');
    if (existingLoader) {
        existingLoader.remove();
    }
    
    if (isLoading) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'map-loading';
        loadingDiv.className = 'map-loading';
        loadingDiv.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2">Đang tải bản đồ...</div>
        `;
        document.getElementById('map').parentNode.appendChild(loadingDiv);
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

document.head.insertAdjacentHTML('beforeend', `
<style>
.map-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(255,255,255,0.9);
    border-radius: var(--radius);
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: var(--shadow);
    z-index: 1000;
}

.custom-marker {
    display: flex;
    justify-content: center;
    align-items: center;
}

.custom-marker.pending i {
    color: #f59e0b;
    font-size: 32px;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
}

.custom-marker.approved i {
    color: #4f46e5;
    font-size: 32px;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
}

.pulsing-marker {
    animation: pulse 1.5s infinite;
}

.pulsing-marker i {
    color: #ef4444;
    font-size: 36px;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
}

@keyframes pulse {
    0% {
        transform: scale(0.8);
        opacity: 1;
    }
    50% {
        transform: scale(1.2);
        opacity: 0.8;
    }
    100% {
        transform: scale(0.8);
        opacity: 1;
    }
}

.search-result {
    padding: 5px 0;
}

.custom-popup .leaflet-popup-content-wrapper {
    padding: 0;
    overflow: hidden;
    border-radius: 10px;
}

.custom-popup .leaflet-popup-content {
    margin: 0;
    width: 260px;
}

.popup-header {
    background: linear-gradient(to right, var(--primary), #6366f1);
    color: white;
    padding: 10px 15px;
    font-weight: 600;
}

.popup-body {
    padding: 15px;
}

.popup-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background-color: #f8f9fc;
    border-top: 1px solid var(--gray-light);
    font-size: 12px;
}

.story-image {
    max-width: 100%;
    border-radius: 5px;
    box-shadow: var(--shadow-sm);
}

.author-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    margin-right: 5px;
}

.post-author {
    display: flex;
    align-items: center;
}

@media (max-width: 576px) {
    .custom-popup .leaflet-popup-content {
        width: 220px;
    }
    
    .popup-body {
        padding: 10px;
    }
    
    .popup-footer {
        padding: 8px 10px;
        font-size: 11px;
    }
}
</style>
`);
