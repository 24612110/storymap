document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggleTop = document.getElementById('sidebarToggleTop');
    const closeSidebarMobile = document.getElementById('closeSidebarMobile');
    const body = document.body;
    if (sidebarToggleTop) {
        sidebarToggleTop.addEventListener('click', function() {
            body.classList.add('sidebar-active');
        });
    }
    if (closeSidebarMobile) {
        closeSidebarMobile.addEventListener('click', function() {
            body.classList.remove('sidebar-active');
        });
    }
    document.addEventListener('click', function(e) {
        if (body.classList.contains('sidebar-active') && 
            !document.getElementById('sidebar-wrapper').contains(e.target) && 
            !document.getElementById('sidebarToggleTop').contains(e.target)) {
            body.classList.remove('sidebar-active');
        }
    });
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('table-responsive');
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });
    initCharts();

    if (window.isDashboardWithMap) {
        initAdminMap();
        initCountryChart();
    }
});

function initCharts() {
    const growthChart = document.getElementById('growthChart');
    if (growthChart) {
        new Chart(growthChart, {
            type: 'line',
            data: {
                labels: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
                datasets: [
                    {
                        label: 'Người dùng',
                        data: [15, 25, 40, 60, 80, 105, 140, 160, 180, 200, 210, 215],
                        backgroundColor: 'rgba(78, 115, 223, 0.05)',
                        borderColor: 'rgba(78, 115, 223, 1)',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'Bài đăng',
                        data: [20, 60, 100, 150, 200, 250, 300, 350, 400, 450, 500, 534],
                        backgroundColor: 'rgba(28, 200, 138, 0.05)',
                        borderColor: 'rgba(28, 200, 138, 1)',
                        borderWidth: 2,
                        tension: 0.3
                    }
                ]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                layout: {
                    padding: {
                        left: 10,
                        right: 25,
                        top: 25,
                        bottom: 0
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            maxTicksLimit: window.innerWidth < 768 ? 4 : 12
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            maxTicksLimit: 5,
                            padding: 10
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 20
                        }
                    }
                }
            }
        });
    }
    
    const categoriesChart = document.getElementById('categoriesChart');
    if (categoriesChart) {
        new Chart(categoriesChart, {
            type: 'doughnut',
            data: {
                labels: ['Du lịch', 'Lịch sử', 'Ẩm thực', 'Sự kiện', 'Cá nhân'],
                datasets: [{
                    data: [30, 22, 18, 15, 15],
                    backgroundColor: [
                        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'
                    ],
                    hoverBackgroundColor: [
                        '#2e59d9', '#17a673', '#2c9faf', '#dda20a', '#be2617'
                    ],
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: window.innerWidth < 768 ? 'bottom' : 'right',
                        labels: {
                            boxWidth: window.innerWidth < 768 ? 12 : 20,
                            padding: window.innerWidth < 768 ? 10 : 20
                        }
                    }
                }
            }
        });
    }
}

function initAdminMap() {
    const mapElement = document.getElementById('admin-map');
    if (!mapElement) return;
    
    if (!window.mapPosts) {
        console.error('Map post data not available');
        return;
    }
    
    const adminMap = L.map('admin-map').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(adminMap);
    
    const allMarkers = [];
    const pendingMarkers = [];
    const approvedMarkers = [];
    
    const allLayerGroup = L.layerGroup().addTo(adminMap);
    const pendingLayerGroup = L.layerGroup();
    const approvedLayerGroup = L.layerGroup();
    
    window.mapPosts.forEach(post => {
        if (!post.location || !post.location.coordinates || post.location.coordinates.length < 2) return;
        
        const lng = post.location.coordinates[0];
        const lat = post.location.coordinates[1];
        
        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<i class="fas fa-map-marker-alt ${post.isPending ? 'text-warning' : 'text-success'}"></i>`,
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });
        
        const marker = L.marker([lat, lng], { icon: markerIcon });
        
        const popupContent = `
            <div class="post-popup">
                <h6>${post.title}</h6>
                <p class="mb-1 small">
                    <strong>Tác giả:</strong> ${post.author?.username || 'Không xác định'}
                </p>
                <p class="mb-0 small">
                    <strong>Trạng thái:</strong> 
                    ${post.isPending 
                        ? '<span class="badge bg-warning text-dark">Chờ duyệt</span>' 
                        : '<span class="badge bg-success">Đã duyệt</span>'}
                </p>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        allMarkers.push(marker);
        allLayerGroup.addLayer(marker);
        
        if (post.isPending) {
            pendingMarkers.push(marker);
            pendingLayerGroup.addLayer(marker);
        } else {
            approvedMarkers.push(marker);
            approvedLayerGroup.addLayer(marker);
        }
    });
    
    const filterLinks = document.querySelectorAll('.map-filter');
    filterLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            filterLinks.forEach(l => l.classList.remove('active'));
            
            this.classList.add('active');
            
            const filterType = this.getAttribute('data-filter');
            
            adminMap.removeLayer(allLayerGroup);
            adminMap.removeLayer(pendingLayerGroup);
            adminMap.removeLayer(approvedLayerGroup);
            
            if (filterType === 'all') {
                allLayerGroup.addTo(adminMap);
            } else if (filterType === 'pending') {
                pendingLayerGroup.addTo(adminMap);
            } else if (filterType === 'approved') {
                approvedLayerGroup.addTo(adminMap);
            }
        });
    });
}

function initCountryChart() {
    const ctx = document.getElementById('countriesChart');
    if (!ctx || !window.topCountries) return;
    
    const labels = window.topCountries.map(c => c.name);
    const data = window.topCountries.map(c => c.count);
    
    const colors = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
        '#2e59d9', '#17a673', '#2c9faf', '#dda20a', '#be2617'
    ];
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: window.innerWidth < 768 ? 'bottom' : 'right',
                    labels: {
                        padding: 15
                    }
                }
            }
        }
    });
}

window.addEventListener('resize', function() {
    if (typeof Chart !== 'undefined') {
        Chart.instances.forEach(instance => {
            instance.resize();
        });
    }
});
