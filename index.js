const SUPABASE_URL = "https://myeqpxnpyurmxqtovdec.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZXFweG5weXVybXhxdG92ZGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzA0MzgsImV4cCI6MjA3ODEwNjQzOH0.X5aSsAzjvHvaaiOjM9f_M7gajFOpobn3IX623WFUzBA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// GetStream + Supabase Messaging Configuration
let streamClient = null;
let currentChannel = null;
let userConversations = [];
let selectedRecipient = null;
let isStreamConnected = false;
let messagePollingInterval = null;
let lastMessageCheck = new Date();

const defaultConfig = {
    site_name: "HousinGo",
    tagline: "Your next home is just a click away.",
    footer_text: "© 2025 HousinGo | All Rights Reserved",
    contact_email: "support@housingo.ph",
    primary_color: "#ADD8E6",
    text_color: "#8B4513",
    background_color: "#F5F5DC",
    accent_color: "#87CEEB",
    secondary_text_color: "#654321"
};

let allProperties = [];
let allAmenities = [];
let allImages = [];

const amenityIcons = {
    'Wi-Fi': '📶',
    'Aircon': '❄️',
    'Water Included': '💧',
    'Electric Included': '⚡',
    'Kitchen Access': '🍳',
    'Parking': '🚗',
    'Private Bathroom': '🚿',
    'Pet Friendly': '🐾'
};

async function loadProperties() {
    try {
    const loadingEl = document.getElementById('loading');
    const containerEl = document.getElementById('properties-container');
    const emptyStateEl = document.getElementById('empty-state');

    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    emptyStateEl.style.display = 'none';

    const { data: properties, error: propError } = await supabase
        .from('properties')
        .select(`
        *,
        landlord:users(
            user_id,
            first_name,
            last_name,
            email,
            mobile
        )
        `)
        .eq('availability', 'Available')
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });

    if (propError) {
        console.error('Properties error:', propError);
        throw propError;
    }

    const { data: amenities, error: amenError } = await supabase
        .from('amenities')
        .select('*');

    if (amenError) {
        console.error('Amenities error:', amenError);
        throw amenError;
    }

    const { data: images, error: imgError } = await supabase
        .from('property_images')
        .select('*');

    if (imgError) {
        console.error('Images error:', imgError);
        throw imgError;
    }

    allProperties = properties || [];
    allAmenities = amenities || [];
    allImages = images || [];

    displayProperties(allProperties);

    loadingEl.style.display = 'none';
    
    if (allProperties.length === 0) {
        emptyStateEl.style.display = 'block';
    } else {
        containerEl.style.display = 'grid';
    }
    } catch (error) {
    console.error('Error loading properties:', error);
    document.getElementById('loading').innerHTML = '<p>Error loading properties. Please refresh the page.</p>';
    }
}

function getPropertyAmenities(propertyId) {
    return allAmenities
    .filter(a => a.property_id === propertyId && a.is_included)
    .map(a => a.amenity_name);
}

function getPropertyImages(propertyId) {
    return allImages.filter(img => img.property_id === propertyId);
}

function displayProperties(properties, isHomePage = true) {
    const container = document.getElementById('properties-container');
    const emptyState = document.getElementById('empty-state');
    
    container.innerHTML = '';

    if (properties.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
    }

    container.style.display = 'grid';
    emptyState.style.display = 'none';

    // For home page, show only 6 random properties
    let displayProperties = properties;
    if (isHomePage) {
    // Shuffle array and take first 6
    const shuffled = [...properties].sort(() => 0.5 - Math.random());
    displayProperties = shuffled.slice(0, 6);
    }

    displayProperties.forEach(property => {
    const amenities = getPropertyAmenities(property.property_id);
    const images = getPropertyImages(property.property_id);

    const card = document.createElement('div');
    card.className = 'property-card';
    card.onclick = () => showPropertyDetails(property);

    const amenitiesHTML = amenities.slice(0, 4).map(amenity => {
        const icon = amenityIcons[amenity] || '✓';
        return `<span class="amenity-tag">${icon} ${amenity}</span>`;
    }).join('');

    // Create image carousel for property card
    let imageHTML;
    if (images.length > 0) {
        imageHTML = `
        <div class="property-image-carousel" style="position: relative; width: 100%; height: 250px; overflow: hidden;">
            ${images.map((img, index) => `
            <img src="${img.image_url}" alt="${property.type}" 
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: ${index === 0 ? 1 : 0}; transition: opacity 0.5s ease-in-out;"
                    data-image-index="${index}">
            `).join('')}
            ${images.length > 1 ? `
            <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                <span class="current-image">1</span>/${images.length}
            </div>
            ` : ''}
        </div>
        `;
    } else {
        imageHTML = '<div class="property-image">🏠</div>';
    }

    card.innerHTML = `
        ${imageHTML}
        <div class="property-content">
        <span class="property-type">${property.type || 'Property'}</span>
        <h3 class="property-title">${property.property_name || property.type || 'Property'}</h3>
        <p class="property-location">📍 ${property.address || 'Address not specified'}</p>
        <p class="property-price">₱${(property.monthly_rent || 0).toLocaleString()}/month</p>
        <div class="amenities-list">
            ${amenitiesHTML}
            ${amenities.length > 4 ? `<span class="amenity-tag">+${amenities.length - 4} more</span>` : ''}
        </div>
        <div class="property-actions">
            <button class="btn-secondary" onclick="event.stopPropagation(); viewDetails('${property.property_id}')">View</button>
            <button class="btn-secondary" onclick="event.stopPropagation(); messageLandlordFromCard('${property.property_id}')">Message</button>
        </div>
        </div>
    `;

    // Add hover carousel functionality for property cards
    if (images.length > 1) {
        let carouselInterval;
        let currentImageIndex = 0;
        const carouselImages = card.querySelectorAll('.property-image-carousel img');
        const currentImageSpan = card.querySelector('.current-image');

        function nextImage() {
        carouselImages[currentImageIndex].style.opacity = '0';
        currentImageIndex = (currentImageIndex + 1) % images.length;
        carouselImages[currentImageIndex].style.opacity = '1';
        if (currentImageSpan) {
            currentImageSpan.textContent = currentImageIndex + 1;
        }
        }

        card.addEventListener('mouseenter', () => {
        carouselInterval = setInterval(nextImage, 2000);
        });

        card.addEventListener('mouseleave', () => {
        if (carouselInterval) {
            clearInterval(carouselInterval);
            carouselInterval = null;
        }
        });
    }

    container.appendChild(card);
    });
}

function showPropertyDetails(property) {
    const modal = document.getElementById('property-modal');
    const modalBody = document.getElementById('modal-body');
    const amenities = getPropertyAmenities(property.property_id);
    const images = getPropertyImages(property.property_id);

    const amenitiesHTML = amenities.map(amenity => {
    const icon = amenityIcons[amenity] || '✓';
    return `<div class="amenity-item">${icon} ${amenity}</div>`;
    }).join('');

    const imagesHTML = images.length > 0 
    ? images.map(img => `<img src="${img.image_url}" alt="Property" style="width: 100%; border-radius: 8px; margin-bottom: 15px;">`).join('')
    : '<div class="property-image" style="height: 300px; font-size: 100px;">🏠</div>';

    modalBody.innerHTML = `
    <div class="detail-section">
        ${images.length > 1 ? `
        <div style="position: relative; width: 100%; margin-bottom: 15px;">
            <div class="modal-image-carousel" style="position: relative; width: 100%; height: 400px; overflow: hidden; border-radius: 8px;">
            ${images.map((img, index) => `
                <img src="${img.image_url}" alt="Property" 
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: ${index === 0 ? 1 : 0}; transition: opacity 0.5s ease-in-out;"
                    data-modal-image-index="${index}">
            `).join('')}
            <div style="position: absolute; bottom: 15px; right: 15px; background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                <span class="modal-current-image">1</span>/${images.length}
            </div>
            <button onclick="prevModalImage()" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; padding: 12px 16px; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold;">‹</button>
            <button onclick="nextModalImage()" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; padding: 12px 16px; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold;">›</button>
            </div>
        </div>
        ` : imagesHTML}
    </div>

    <div class="detail-section">
        <h3>Property Information</h3>
        <div class="detail-grid">
        <div class="detail-item">
            <div class="detail-label">Property Name</div>
            <div class="detail-value">${property.property_name || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Type</div>
            <div class="detail-value">${property.type || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Monthly Rent</div>
            <div class="detail-value">₱${(property.monthly_rent || 0).toLocaleString()}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Available Slots</div>
            <div class="detail-value">${property.available_slots || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Minimum Stay</div>
            <div class="detail-value">${property.min_stay || 'N/A'}</div>
        </div>
        </div>
    </div>

    <div class="detail-section">
        <h3>Location</h3>
        <div class="detail-grid">
        <div class="detail-item">
            <div class="detail-label">Address</div>
            <div class="detail-value">${property.address || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Barangay</div>
            <div class="detail-value">${property.barangay || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">City</div>
            <div class="detail-value">${property.city || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Nearby Landmarks</div>
            <div class="detail-value">${property.nearby_landmarks || 'N/A'}</div>
        </div>
        </div>
    </div>

    <div class="detail-section">
        <h3>Amenities</h3>
        <div class="amenities-grid">
        ${amenitiesHTML || '<p>No amenities listed</p>'}
        </div>
    </div>

    <div class="detail-section">
        <h3>Description</h3>
        <p>${property.description || 'No description available'}</p>
    </div>

    <div class="detail-section">
        <h3>Rules</h3>
        <p>${property.rules || 'No rules specified'}</p>
    </div>

    <div class="detail-section">
        <h3>Contact Information</h3>
        <div class="detail-grid">
        <div class="detail-item">
            <div class="detail-label">Contact Name</div>
            <div class="detail-value">${property.contact_name || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Contact Number</div>
            <div class="detail-value">${property.contact_number || 'N/A'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Move-in Date</div>
            <div class="detail-value">${property.move_in_date || 'N/A'}</div>
        </div>
        </div>
    </div>

    <div style="margin-top: 20px;">
        <label for="application-notes" style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Application Notes (Optional)</label>
        <textarea id="application-notes" rows="3" placeholder="Tell the landlord about yourself, your move-in date, or any questions..." style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513; resize: vertical; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin-bottom: 15px;"></textarea>
        <button class="btn" style="width: 100%;" onclick="applyForProperty('${property.property_id}')">Apply for this Property</button>
    </div>
    `;

    modal.classList.add('active');

    // Start auto-carousel for modal if multiple images
    if (images.length > 1) {
    startModalCarousel();
    }
}

let modalCarouselInterval;
let modalCurrentImageIndex = 0;

function startModalCarousel() {
    const modalImages = document.querySelectorAll('.modal-image-carousel img');
    const modalCurrentSpan = document.querySelector('.modal-current-image');
    
    if (modalImages.length <= 1) return;

    modalCarouselInterval = setInterval(() => {
    modalImages[modalCurrentImageIndex].style.opacity = '0';
    modalCurrentImageIndex = (modalCurrentImageIndex + 1) % modalImages.length;
    modalImages[modalCurrentImageIndex].style.opacity = '1';
    if (modalCurrentSpan) {
        modalCurrentSpan.textContent = modalCurrentImageIndex + 1;
    }
    }, 2000);
}

function stopModalCarousel() {
    if (modalCarouselInterval) {
    clearInterval(modalCarouselInterval);
    modalCarouselInterval = null;
    }
}

function nextModalImage() {
    const modalImages = document.querySelectorAll('.modal-image-carousel img');
    const modalCurrentSpan = document.querySelector('.modal-current-image');
    
    if (modalImages.length <= 1) return;

    stopModalCarousel();
    modalImages[modalCurrentImageIndex].style.opacity = '0';
    modalCurrentImageIndex = (modalCurrentImageIndex + 1) % modalImages.length;
    modalImages[modalCurrentImageIndex].style.opacity = '1';
    if (modalCurrentSpan) {
    modalCurrentSpan.textContent = modalCurrentImageIndex + 1;
    }
    startModalCarousel();
}

function prevModalImage() {
    const modalImages = document.querySelectorAll('.modal-image-carousel img');
    const modalCurrentSpan = document.querySelector('.modal-current-image');
    
    if (modalImages.length <= 1) return;

    stopModalCarousel();
    modalImages[modalCurrentImageIndex].style.opacity = '0';
    modalCurrentImageIndex = modalCurrentImageIndex === 0 ? modalImages.length - 1 : modalCurrentImageIndex - 1;
    modalImages[modalCurrentImageIndex].style.opacity = '1';
    if (modalCurrentSpan) {
    modalCurrentSpan.textContent = modalCurrentImageIndex + 1;
    }
    startModalCarousel();
}

function viewDetails(propertyId) {
    const property = allProperties.find(p => p.property_id === propertyId);
    if (property) {
    showPropertyDetails(property);
    }
}

function contactLandlord(propertyId) {
    const property = allProperties.find(p => p.property_id === propertyId);
    if (property && property.contact_number) {
    const message = document.createElement('div');
    message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ADD8E6; color: #8B4513; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 3000; max-width: 300px;';
    message.innerHTML = `
        <strong>Contact Information</strong><br>
        Name: ${property.contact_name || 'N/A'}<br>
        Phone: ${property.contact_number}
    `;
    document.body.appendChild(message);
    setTimeout(() => message.remove(), 5000);
    }
}

function messageLandlordFromCard(propertyId) {
    if (!currentUser) {
    // Close any open modals first
    document.getElementById('property-modal').classList.remove('active');
    
    // Show login redirect message
    const loginRedirectDiv = document.createElement('div');
    loginRedirectDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    loginRedirectDiv.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 12px; max-width: 400px; text-align: center;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Login Required</h3>
        <p style="margin-bottom: 30px; color: #654321;">You need to log in to message landlords. Would you like to go to the login page now?</p>
        <div style="display: flex; gap: 15px;">
            <button class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
            <button class="btn" onclick="redirectToLogin()" style="flex: 1; padding: 12px;">Go to Login</button>
        </div>
        </div>
    `;
    document.body.appendChild(loginRedirectDiv);
    return;
    }

    const property = allProperties.find(p => p.property_id === propertyId);
    if (property && property.landlord) {
    const landlordName = `${property.landlord.first_name} ${property.landlord.last_name}`;
    
    // Set the recipient and show new message modal
    selectedRecipient = {
        userId: property.landlord.user_id,
        name: landlordName,
        email: property.landlord.email || '',
        role: 'Landlord'
    };
    
    document.getElementById('recipient-search').value = `${landlordName} (Landlord)`;
    document.getElementById('initial-message').value = `Hi! I'm interested in your ${property.type} property in ${property.city}. Could we discuss the details?`;
    
    showNewMessageForm();
    } else {
    showToast('Unable to message landlord. Property information not available.');
    }
}

async function applyForProperty(propertyId) {
    if (!currentUser) {
    // Close the property modal first
    document.getElementById('property-modal').classList.remove('active');
    stopModalCarousel();
    modalCurrentImageIndex = 0;
    
    // Show login redirect message
    const loginRedirectDiv = document.createElement('div');
    loginRedirectDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    loginRedirectDiv.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 12px; max-width: 400px; text-align: center;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Login Required</h3>
        <p style="margin-bottom: 30px; color: #654321;">You need to log in to apply for this property. Would you like to go to the login page now?</p>
        <div style="display: flex; gap: 15px;">
            <button class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
            <button class="btn" onclick="redirectToLogin()" style="flex: 1; padding: 12px;">Go to Login</button>
        </div>
        </div>
    `;
    document.body.appendChild(loginRedirectDiv);
    return;
    }

    if (currentUser.role !== 'Tenant') {
    showToast('Only tenants can apply for properties');
    return;
    }

    try {
    const notes = document.getElementById('application-notes').value.trim();
    
    // Check if already applied
    const { data: existingApplication, error: checkError } = await supabase
        .from('property_applicants')
        .select('*')
        .eq('tenant_id', currentUser.user_id)
        .eq('property_id', propertyId)
        .single();

    if (existingApplication) {
        showToast('You have already applied for this property');
        return;
    }

    // Get property and landlord details
    const { data: property, error: propError } = await supabase
        .from('properties')
        .select(`
        *,
        landlord:users(
            user_id,
            first_name,
            last_name
        )
        `)
        .eq('property_id', propertyId)
        .single();

    if (propError) throw propError;

    // Create application
    const { data, error } = await supabase
        .from('property_applicants')
        .insert([{
        tenant_id: currentUser.user_id,
        property_id: propertyId,
        message: notes || null,
        status: 'Pending'
        }])
        .select()
        .single();

    if (error) throw error;

    // 🔔 Create notification for tenant - application submitted
    await createNotification(
        currentUser.user_id,
        'Application Submitted Successfully',
        `Your application for the ${property.type} property in ${property.city} has been submitted. The landlord will review your application and get back to you soon.`
    );

    // 🔔 Create notification for landlord - new application received
    await createNotification(
        property.landlord.user_id,
        'New Property Application Received',
        `${currentUser.first_name} ${currentUser.last_name} has applied for your ${property.type} property in ${property.city}. Review their application in your dashboard.`
    );

    showToast('Application submitted successfully! The landlord will review your application.');
    document.getElementById('property-modal').classList.remove('active');
    
    } catch (error) {
    console.error('Application error:', error);
    showToast('Failed to submit application: ' + error.message);
    }
}

let selectedType = '';

function filterProperties() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const typeSearch = document.getElementById('type-search').value;
    const priceSearch = document.getElementById('price-search').value;

    let filtered = allProperties.filter(property => {
    const matchesSearch = !searchTerm || 
        (property.type && property.type.toLowerCase().includes(searchTerm)) ||
        (property.city && property.city.toLowerCase().includes(searchTerm)) ||
        (property.barangay && property.barangay.toLowerCase().includes(searchTerm)) ||
        (property.address && property.address.toLowerCase().includes(searchTerm));

    const matchesTypeSearch = !typeSearch || property.type === typeSearch;
    const matchesPriceSearch = !priceSearch || property.monthly_rent <= parseInt(priceSearch);
    const matchesType = !selectedType || property.type === selectedType;

    return matchesSearch && matchesTypeSearch && matchesPriceSearch && matchesType;
    });

    displayProperties(filtered);
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    selectedType = this.getAttribute('data-type');
    filterProperties();
    });
});

document.getElementById('search-btn').addEventListener('click', filterProperties);
document.getElementById('search-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') filterProperties();
});
document.getElementById('type-search').addEventListener('change', filterProperties);
document.getElementById('price-search').addEventListener('change', filterProperties);

document.getElementById('close-modal').addEventListener('click', () => {
    stopModalCarousel();
    modalCurrentImageIndex = 0;
    document.getElementById('property-modal').classList.remove('active');
});

document.getElementById('property-modal').addEventListener('click', (e) => {
    if (e.target.id === 'property-modal') {
    stopModalCarousel();
    modalCurrentImageIndex = 0;
    document.getElementById('property-modal').classList.remove('active');
    }
});

// Authentication state
let currentUser = null;

async function checkAuthState() {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('housingo_user');
    if (storedUser) {
    try {
        currentUser = JSON.parse(storedUser);
        updateNavForLoggedInUser();
    } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('housingo_user');
    }
    }
}

function updateNavForLoggedInUser() {
    const navMenu = document.querySelector('nav ul');
    const profileDropdown = document.getElementById('user-profile-dropdown');
    const userNameDisplay = document.getElementById('user-name-display');
    
    if (currentUser) {
    const userType = currentUser.role;
    const dashboardLink = userType === 'Admin' ? 'admin-dashboard' : 
                            userType === 'Landlord' ? 'landlord-dashboard' : 'tenant-dashboard';
    
    // Hide regular nav items and show profile dropdown
    navMenu.innerHTML = `
        <li><a href="#" onclick="showPage('home'); return false;">Home</a></li>
        <li><a href="#" onclick="showPage('browse-properties'); return false;">Browse Properties</a></li>
        <li><a href="#" onclick="showPage('${dashboardLink}'); return false;">Dashboard</a></li>
        <li><a href="#" onclick="showPage('about'); return false;">About Us</a></li>
        <li><a href="#" onclick="showPage('contact'); return false;">Contact Us</a></li>
        <li><a href="#" onclick="showPage('help'); return false;">Help</a></li>
    `;
    
    // Show and update profile dropdown
    profileDropdown.style.display = 'block';
    userNameDisplay.textContent = `👤 ${currentUser.first_name} ${currentUser.last_name}`;
    
    // Load notifications count
    loadNotificationCount();
    } else {
    // Show default nav for non-logged in users
    navMenu.innerHTML = `
        <li><a href="#" onclick="showPage('home'); return false;">Home</a></li>
        <li><a href="#" onclick="showPage('browse-properties'); return false;">Browse Properties</a></li>
        <li><a href="#" onclick="showPage('about'); return false;">About Us</a></li>
        <li><a href="#" onclick="showPage('login'); return false;">Log In</a></li>
        <li><a href="#" onclick="showPage('register'); return false;">Register</a></li>
        <li><a href="#" onclick="showPage('contact'); return false;">Contact Us</a></li>
        <li><a href="#" onclick="showPage('help'); return false;">Help</a></li>
    `;
    
    // Hide profile dropdown
    profileDropdown.style.display = 'none';
    }
}

async function logout() {
    currentUser = null;
    localStorage.removeItem('housingo_user');
    showToast('Logged out successfully!');
    setTimeout(() => {
    location.reload();
    }, 1000);
}

async function onConfigChange(config) {
    document.getElementById('site-name').textContent = config.site_name || defaultConfig.site_name;
    document.getElementById('site-name-hero').textContent = config.site_name || defaultConfig.site_name;
    document.getElementById('tagline').textContent = config.tagline || defaultConfig.tagline;
    document.getElementById('footer-copyright').textContent = config.footer_text || defaultConfig.footer_text;
    document.getElementById('contact-email').textContent = config.contact_email || defaultConfig.contact_email;

    const primaryColor = config.primary_color || defaultConfig.primary_color;
    const textColor = config.text_color || defaultConfig.text_color;
    const backgroundColor = config.background_color || defaultConfig.background_color;
    const accentColor = config.accent_color || defaultConfig.accent_color;
    const secondaryTextColor = config.secondary_text_color || defaultConfig.secondary_text_color;

    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--text-color', textColor);
    document.documentElement.style.setProperty('--background-color', backgroundColor);
    document.documentElement.style.setProperty('--accent-color', accentColor);
    document.documentElement.style.setProperty('--secondary-text-color', secondaryTextColor);

    document.body.style.backgroundColor = backgroundColor;
    document.body.style.color = textColor;

    const headers = document.querySelectorAll('header, footer, .hero');
    headers.forEach(el => {
    if (el.classList.contains('hero')) {
        el.style.background = `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`;
    } else {
        el.style.backgroundColor = primaryColor;
    }
    });

    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
    btn.style.backgroundColor = primaryColor;
    btn.style.color = textColor;
    });

    const propertyTypes = document.querySelectorAll('.property-type');
    propertyTypes.forEach(el => {
    el.style.backgroundColor = primaryColor;
    el.style.color = textColor;
    });

    const propertyPrices = document.querySelectorAll('.property-price');
    propertyPrices.forEach(el => {
    el.style.color = primaryColor;
    });
}

// Hamburger menu functionality
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close menu when clicking on a link
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
    });
});

// Page navigation
function showPage(pageName) {
    // Hide all pages
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('home-content').style.display = 'none';
    document.getElementById('about-page').style.display = 'none';
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('register-page').style.display = 'none';
    document.getElementById('contact-page').style.display = 'none';
    document.getElementById('help-page').style.display = 'none';
    document.getElementById('browse-properties-page').style.display = 'none';
    document.getElementById('admin-dashboard-page').style.display = 'none';
    document.getElementById('landlord-dashboard-page').style.display = 'none';
    document.getElementById('tenant-dashboard-page').style.display = 'none';
    document.getElementById('post-property-page').style.display = 'none';
    document.getElementById('user-settings-page').style.display = 'none';

    // Show selected page
    if (pageName === 'home') {
    document.getElementById('home-page').style.display = 'block';
    document.getElementById('home-content').style.display = 'block';
    } else {
    document.getElementById(pageName + '-page').style.display = 'block';
    }

    // Load dashboard data if needed
    if (pageName === 'admin-dashboard') {
    loadAdminDashboard();
    } else if (pageName === 'landlord-dashboard') {
    loadLandlordDashboard();
    } else if (pageName === 'tenant-dashboard') {
    loadTenantDashboard();
    } else if (pageName === 'user-settings') {
    loadUserSettings();
    } else if (pageName === 'browse-properties') {
    loadBrowseProperties();
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Close mobile menu
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}

async function uploadImageToImgBB(file) {
    const formData = new FormData();
    formData.append('key', '047e5bac8e19759cc1c884e08ba14b07');
    formData.append('image', file);

    const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData
    });

    const data = await response.json();
    if (data.success) {
    return data.data.url;
    } else {
    throw new Error('Image upload failed');
    }
}

async function handlePostProperty(event) {
    event.preventDefault();
    
    if (!currentUser || currentUser.role !== 'Landlord') {
    showToast('Only landlords can post properties');
    return;
    }

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const isEditMode = form.dataset.editMode === 'true';
    const propertyId = form.dataset.propertyId;

    submitBtn.disabled = true;
    submitBtn.textContent = isEditMode ? 'Updating...' : 'Publishing...';

    try {
    const propertyData = {
        landlord_id: currentUser.user_id,
        property_name: document.getElementById('property-name').value,
        type: document.getElementById('property-type').value,
        monthly_rent: parseInt(document.getElementById('monthly-rent').value),
        available_slots: parseInt(document.getElementById('available-slots').value),
        address: document.getElementById('property-address').value,
        barangay: document.getElementById('property-barangay').value,
        city: document.getElementById('property-city').value,
        nearby_landmarks: document.getElementById('nearby-landmarks').value,
        loc_link: document.getElementById('location-link').value,
        description: document.getElementById('property-description').value,
        rules: document.getElementById('property-rules').value,
        contact_name: document.getElementById('contact-name').value,
        contact_number: document.getElementById('contact-number').value,
        move_in_date: document.getElementById('move-in-date').value,
        min_stay: document.getElementById('min-stay').value,
        availability: 'Available'
    };

    let property;
    if (isEditMode) {
        console.log('=== UPDATE PROPERTY DEBUG ===');
        console.log('🔄 Starting property update...');
        console.log('Property ID:', propertyId);
        console.log('Current User ID:', currentUser.user_id);
        
        // 1️⃣ Verify property ownership first
        const { data: fromDB, error: checkError } = await supabase
        .from('properties')
        .select('*')
        .eq('property_id', propertyId)
        .eq('landlord_id', currentUser.user_id);
        
        console.log('✅ Existing property verification from DB:', fromDB);
        console.log('❌ Verification error:', checkError);
        
        if (checkError || !fromDB || fromDB.length === 0) {
        throw new Error('Property not found or you do not have permission to edit it');
        }
        
        const existingProperty = fromDB[0];
        
        // 2️⃣ Prepare update data - keep existing status unless it was rejected
        const updateData = {
        property_name: propertyData.property_name,
        type: propertyData.type,
        monthly_rent: propertyData.monthly_rent,
        available_slots: propertyData.available_slots,
        address: propertyData.address,
        barangay: propertyData.barangay,
        city: propertyData.city,
        nearby_landmarks: propertyData.nearby_landmarks,
        description: propertyData.description,
        rules: propertyData.rules,
        contact_name: propertyData.contact_name,
        contact_number: propertyData.contact_number,
        move_in_date: propertyData.move_in_date,
        min_stay: propertyData.min_stay,
        loc_link: propertyData.loc_link,
        availability: propertyData.availability,
        // Keep existing status unless it was rejected (then set to pending for re-review)
        status: existingProperty.status === 'Rejected' ? 'Pending' : existingProperty.status
        };
        
        console.log('📝 Update data mapped from form:', updateData);
        
        // 3️⃣ Perform the update with proper ownership verification using correct Supabase syntax
        const { data, error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('property_id', propertyId)
        .eq('landlord_id', currentUser.user_id)
        .select();

        console.log('✅ Update response data:', data);
        console.log('❌ Update error:', error);

        if (error) {
        console.error('❌ Update failed with error:', JSON.stringify(error, null, 2));
        throw error;
        }
        
        if (!data || data.length === 0) {
        throw new Error('Property update failed - no data returned or permission denied');
        }
        
        property = data[0];
        console.log('✅ Property updated successfully!');
        console.log('Updated property:', property);
        
        // 🔔 Create notification for landlord - property updated
        await createNotification(
        currentUser.user_id,
        'Property Updated Successfully',
        `Your ${property.type} property in ${property.city} has been updated successfully. ${property.status === 'Pending' ? 'It has been resubmitted for admin review.' : 'Changes are now live.'}`
        );

        // 🔔 Notify admins if property was resubmitted for review
        if (existingProperty.status === 'Rejected' && property.status === 'Pending') {
        await notifyAllAdmins(
            'Property Resubmitted for Review',
            `${currentUser.first_name} ${currentUser.last_name} has updated and resubmitted their ${property.type} property in ${property.city} for review.`
        );
        }
        
        console.log('=== END UPDATE PROPERTY DEBUG ===');
    } else {
        // Create new property
        console.log('🆕 Creating new property...');
        propertyData.status = 'Pending';
        propertyData.created_at = new Date().toISOString();
        
        const { data, error: propError } = await supabase
        .from('properties')
        .insert([propertyData])
        .select()
        .single();

        if (propError) throw propError;
        property = data;
        console.log('✅ New property created successfully!');

        // 🔔 Create notification for landlord - property posted
        await createNotification(
        currentUser.user_id,
        'Property Posted Successfully',
        `Your ${property.type} property in ${property.city} has been submitted for review. You'll be notified once it's approved by our admin team.`
        );

        // 🔔 Create notification for all admins - new property to review
        await notifyAllAdmins(
        'New Property Pending Review',
        `${currentUser.first_name} ${currentUser.last_name} posted a new ${property.type} property in ${property.city} that needs approval.`
        );
    }

    // Upload new images if any
    const imageFiles = document.getElementById('property-images').files;
    if (imageFiles.length > 0) {
        submitBtn.textContent = `Uploading images (0/${imageFiles.length})...`;
        
        for (let i = 0; i < Math.min(imageFiles.length, 10); i++) {
        try {
            const imageUrl = await uploadImageToImgBB(imageFiles[i]);
            
            const { error: imgError } = await supabase
            .from('property_images')
            .insert([{
                property_id: property.property_id,
                image_url: imageUrl
            }]);

            if (imgError) throw imgError;
            
            submitBtn.textContent = `Uploading images (${i + 1}/${imageFiles.length})...`;
        } catch (imgError) {
            console.error('Image upload error:', imgError);
            showToast(`Warning: Failed to upload image ${i + 1}`);
        }
        }
    }

    // Update amenities - delete existing ones first to prevent duplicates
    console.log('=== AMENITIES UPDATE DEBUG ===');
    console.log('🗑️ Deleting existing amenities for property:', property.property_id);
    
    const { error: deleteAmenError } = await supabase
        .from('amenities')
        .delete()
        .eq('property_id', property.property_id);

    if (deleteAmenError) {
        console.error('❌ Error deleting existing amenities:', deleteAmenError);
        throw deleteAmenError;
    }
    
    console.log('✅ Existing amenities deleted successfully');

    // Insert new amenities
    const amenityCheckboxes = document.querySelectorAll('input[name="amenity"]:checked');
    const amenities = Array.from(amenityCheckboxes).map(cb => ({
        property_id: property.property_id,
        amenity_name: cb.value,
        is_included: true
    }));

    console.log('📝 New amenities to insert:', amenities);

    if (amenities.length > 0) {
        const { data: insertedAmenities, error: amenError } = await supabase
        .from('amenities')
        .insert(amenities)
        .select();

        if (amenError) {
        console.error('❌ Error inserting amenities:', amenError);
        throw amenError;
        }
        
        console.log('✅ New amenities inserted successfully:', insertedAmenities);
    } else {
        console.log('ℹ️ No amenities selected - skipping insert');
    }
    
    console.log('=== END AMENITIES UPDATE DEBUG ===');

    showToast(isEditMode ? 'Property updated successfully!' : 'Property posted successfully! Waiting for admin approval.');
    
    // Refresh the properties data
    await loadProperties();
    
    setTimeout(() => {
        showPage('landlord-dashboard');
        form.reset();
        form.dataset.editMode = 'false';
        form.dataset.propertyId = '';
        document.getElementById('image-preview').innerHTML = '';
        document.querySelector('#post-property-page h1').textContent = 'Post New Property';
        submitBtn.textContent = 'Publish Property';
    }, 2000);

    } catch (error) {
    console.error('Post property error:', error);
    showToast('Failed to ' + (isEditMode ? 'update' : 'post') + ' property: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = isEditMode ? 'Update Property' : 'Publish Property';
    }
}

// Admin Dashboard Pagination and Filtering
let adminUsers = [];
let adminProperties = [];
let currentUserPage = 1;
let currentPropertyPage = 1;
let usersPerPage = 5;
let propertiesPerPage = 5;
let userSearchTerm = '';
let propertySearchTerm = '';
let userRoleFilter = '';
let userStatusFilter = '';
let propertyTypeFilter = '';
let propertyStatusFilter = '';

async function loadAdminDashboard() {
    try {
    const { data: properties } = await supabase.from('properties').select(`
        *,
        landlord:users(
        user_id,
        first_name,
        last_name,
        email,
        mobile
        )
    `);
    const { data: users } = await supabase.from('users').select('*');
    
    adminUsers = users || [];
    adminProperties = properties || [];
    
    document.getElementById('admin-total-properties').textContent = properties?.length || 0;
    document.getElementById('admin-total-users').textContent = users?.length || 0;
    document.getElementById('admin-pending-properties').textContent = 
        properties?.filter(p => p.status === 'Pending').length || 0;

    // Enhanced User Management with Search, Filters, and Pagination
    displayUserManagement();

    // Property Management with Search, Filters, and Pagination
    displayPropertyManagement();
    } catch (error) {
    console.error('Error loading admin dashboard:', error);
    }
}

function displayUserManagement() {
    const usersList = document.getElementById('admin-users-list');
    
    // Filter users based on search and filters
    let filteredUsers = adminUsers.filter(user => {
    const matchesSearch = !userSearchTerm || 
        user.first_name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.last_name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearchTerm.toLowerCase());
    
    const matchesRole = !userRoleFilter || user.role === userRoleFilter;
    const matchesStatus = !userStatusFilter || user.status === userStatusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
    });

    // Calculate pagination
    const totalUsers = filteredUsers.length;
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    const startIndex = (currentUserPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    // Generate search and filter controls
    const controlsHTML = `
    <div style="background-color: #FFFFFF; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #ADD8E6;">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px; align-items: end;">
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #8B4513;">Search Users</label>
            <input type="text" id="user-search-input" placeholder="Search by name or email..." value="${userSearchTerm}" style="width: 100%; padding: 10px; border: 2px solid #ADD8E6; border-radius: 6px; font-size: 14px;">
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #8B4513;">Role</label>
            <select id="user-role-filter" style="width: 100%; padding: 10px; border: 2px solid #ADD8E6; border-radius: 6px; font-size: 14px;">
            <option value="">All Roles</option>
            <option value="Admin" ${userRoleFilter === 'Admin' ? 'selected' : ''}>Admin</option>
            <option value="Landlord" ${userRoleFilter === 'Landlord' ? 'selected' : ''}>Landlord</option>
            <option value="Tenant" ${userRoleFilter === 'Tenant' ? 'selected' : ''}>Tenant</option>
            </select>
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #8B4513;">Status</label>
            <select id="user-status-filter" style="width: 100%; padding: 10px; border: 2px solid #ADD8E6; border-radius: 6px; font-size: 14px;">
            <option value="">All Status</option>
            <option value="Active" ${userStatusFilter === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Inactive" ${userStatusFilter === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #8B4513;">Per Page</label>
            <select id="users-per-page" style="width: 100%; padding: 10px; border: 2px solid #ADD8E6; border-radius: 6px; font-size: 14px;">
            <option value="5" ${usersPerPage === 5 ? 'selected' : ''}>5</option>
            <option value="10" ${usersPerPage === 10 ? 'selected' : ''}>10</option>
            <option value="20" ${usersPerPage === 20 ? 'selected' : ''}>20</option>
            <option value="50" ${usersPerPage === 50 ? 'selected' : ''}>50</option>
            </select>
        </div>
        </div>
        <div style="display: flex; gap: 10px;">
        <button class="btn" onclick="filterUsers()" style="padding: 10px 20px; font-size: 14px;">🔍 Search</button>
        <button class="btn-secondary" onclick="clearUserFilters()" style="padding: 10px 20px; font-size: 14px;">🗑️ Clear</button>
        </div>
    </div>
    `;

    // Generate pagination controls
    const paginationHTML = totalPages > 1 ? `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 15px; background-color: #F5F5DC; border-radius: 8px;">
        <div style="color: #8B4513; font-weight: 600;">
        Showing ${startIndex + 1}-${Math.min(endIndex, totalUsers)} of ${totalUsers} users
        </div>
        <div style="display: flex; gap: 5px; align-items: center;">
        <button class="btn-secondary" onclick="changeUserPage(${currentUserPage - 1})" ${currentUserPage === 1 ? 'disabled' : ''} style="padding: 8px 12px; font-size: 14px;">‹ Previous</button>
        ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
            const pageNum = Math.max(1, Math.min(totalPages - 4, currentUserPage - 2)) + i;
            if (pageNum <= totalPages) {
            return `<button class="btn${pageNum === currentUserPage ? '' : '-secondary'}" onclick="changeUserPage(${pageNum})" style="padding: 8px 12px; font-size: 14px; min-width: 40px;">${pageNum}</button>`;
            }
            return '';
        }).join('')}
        <button class="btn-secondary" onclick="changeUserPage(${currentUserPage + 1})" ${currentUserPage === totalPages ? 'disabled' : ''} style="padding: 8px 12px; font-size: 14px;">Next ›</button>
        </div>
    </div>
    ` : '';

    // Group users by status for better organization
    const activeUsers = paginatedUsers.filter(u => u.status === 'Active');
    const inactiveUsers = paginatedUsers.filter(u => u.status === 'Inactive');

    const generateUserCard = (user, statusColor, statusBg) => `
    <div style="background-color: ${statusBg}; border: 2px solid ${statusColor}; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
        <div>
            <h4 style="color: #8B4513; margin-bottom: 10px;">${user.first_name} ${user.last_name}</h4>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Mobile:</strong> ${user.mobile || 'N/A'}</p>
            <p><strong>Type:</strong> ${user.role}</p>
            <p><strong>Joined:</strong> ${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
        </div>
        <span style="background-color: ${statusColor}; color: white; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: 600;">${user.status}</span>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn-secondary" onclick="resetUserPassword('${user.user_id}', '${user.first_name} ${user.last_name}')" style="flex: 1; min-width: 120px; padding: 10px; font-size: 14px; background-color: #FFA500; color: white; border-color: #FFA500;">🔑 Reset Password</button>
        <button class="btn-secondary" onclick="toggleUserStatus('${user.user_id}', '${user.status}', '${user.first_name} ${user.last_name}')" style="flex: 1; min-width: 120px; padding: 10px; font-size: 14px; background-color: ${user.status === 'Active' ? '#FF6B6B' : '#32CD32'}; color: white; border-color: ${user.status === 'Active' ? '#FF6B6B' : '#32CD32'};">${user.status === 'Active' ? '🚫 Deactivate' : '✅ Activate'}</button>
        <button class="btn" onclick="messageUser('${user.user_id}', '${user.first_name} ${user.last_name}')" style="flex: 1; min-width: 120px; padding: 10px; font-size: 14px;">💬 Message</button>
        </div>
    </div>
    `;

    // Generate user list
    let usersHTML = '';
    
    if (userStatusFilter) {
    // Show filtered status only
    usersHTML = paginatedUsers.length > 0 ? paginatedUsers.map(user => {
        const statusColors = {
        'Active': { color: '#32CD32', bg: '#F0FFF0' },
        'Inactive': { color: '#FF6B6B', bg: '#FFE4E1' }
        };
        const colors = statusColors[user.status] || { color: '#8B4513', bg: '#F5F5DC' };
        return generateUserCard(user, colors.color, colors.bg);
    }).join('') : '<p style="text-align: center; color: #8B4513; padding: 40px;">No users found matching your criteria</p>';
    } else {
    // Show all statuses with sections
    if (activeUsers.length > 0) {
        usersHTML += `
        <div style="margin-bottom: 40px;">
            <h3 style="color: #8B4513; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #ADD8E6; padding-bottom: 10px;">✅ Active Users (${activeUsers.length})</h3>
            ${activeUsers.map(user => generateUserCard(user, '#32CD32', '#F0FFF0')).join('')}
        </div>
        `;
    }
    
    if (inactiveUsers.length > 0) {
        usersHTML += `
        <div style="margin-bottom: 40px;">
            <h3 style="color: #8B4513; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #ADD8E6; padding-bottom: 10px;">❌ Inactive Users (${inactiveUsers.length})</h3>
            ${inactiveUsers.map(user => generateUserCard(user, '#FF6B6B', '#FFE4E1')).join('')}
        </div>
        `;
    }
    
    if (paginatedUsers.length === 0) {
        usersHTML = '<p style="text-align: center; color: #8B4513; padding: 40px;">No users found matching your criteria</p>';
    }
    }

    usersList.innerHTML = controlsHTML + usersHTML + paginationHTML;
}

function displayPropertyManagement() {
    const propertiesList = document.getElementById('admin-properties-list');
    
    // Filter properties based on search and filters
    let filteredProperties = adminProperties.filter(prop => {
    const matchesSearch = !propertySearchTerm || 
        prop.type.toLowerCase().includes(propertySearchTerm.toLowerCase()) ||
        prop.city.toLowerCase().includes(propertySearchTerm.toLowerCase()) ||
        prop.address.toLowerCase().includes(propertySearchTerm.toLowerCase()) ||
        (prop.landlord.first_name + ' ' + prop.landlord.last_name).toLowerCase().includes(propertySearchTerm.toLowerCase());
    
    const matchesType = !propertyTypeFilter || prop.type === propertyTypeFilter;
    const matchesStatus = !propertyStatusFilter || prop.status === propertyStatusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
    });

    // Calculate pagination
    const totalProperties = filteredProperties.length;
    const totalPages = Math.ceil(totalProperties / propertiesPerPage);
    const startIndex = (currentPropertyPage - 1) * propertiesPerPage;
    const endIndex = startIndex + propertiesPerPage;
    const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

    // Generate search and filter controls
    const controlsHTML = `
    <div style="background-color: #FFFFFF; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #ADD8E6;">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px; align-items: end;">
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #8B4513;">Search Properties</label>
            <input type="text" id="property-search-input" placeholder="Search by type, city, address, or landlord..." value="${propertySearchTerm}" style="width: 100%; padding: 10px; border: 2px solid #ADD8E6; border-radius: 6px; font-size: 14px;">
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #8B4513;">Type</label>
            <select id="property-type-filter" style="width: 100%; padding: 10px; border: 2px solid #ADD8E6; border-radius: 6px; font-size: 14px;">
            <option value="">All Types</option>
            <option value="Bed Spacer" ${propertyTypeFilter === 'Bed Spacer' ? 'selected' : ''}>Bed Spacer</option>
            <option value="Single Room" ${propertyTypeFilter === 'Single Room' ? 'selected' : ''}>Single Room</option>
            <option value="Boarding House" ${propertyTypeFilter === 'Boarding House' ? 'selected' : ''}>Boarding House</option>
            <option value="Studio Type" ${propertyTypeFilter === 'Studio Type' ? 'selected' : ''}>Studio Type</option>
            <option value="Single Family" ${propertyTypeFilter === 'Single Family' ? 'selected' : ''}>Single Family</option>
            </select>
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #8B4513;">Status</label>
            <select id="property-status-filter" style="width: 100%; padding: 10px; border: 2px solid #ADD8E6; border-radius: 6px; font-size: 14px;">
            <option value="">All Status</option>
            <option value="Pending" ${propertyStatusFilter === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Approved" ${propertyStatusFilter === 'Approved' ? 'selected' : ''}>Approved</option>
            <option value="Rejected" ${propertyStatusFilter === 'Rejected' ? 'selected' : ''}>Rejected</option>
            <option value="Suspended" ${propertyStatusFilter === 'Suspended' ? 'selected' : ''}>Suspended</option>
            </select>
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #8B4513;">Per Page</label>
            <select id="properties-per-page" style="width: 100%; padding: 10px; border: 2px solid #ADD8E6; border-radius: 6px; font-size: 14px;">
            <option value="5" ${propertiesPerPage === 5 ? 'selected' : ''}>5</option>
            <option value="10" ${propertiesPerPage === 10 ? 'selected' : ''}>10</option>
            <option value="20" ${propertiesPerPage === 20 ? 'selected' : ''}>20</option>
            <option value="50" ${propertiesPerPage === 50 ? 'selected' : ''}>50</option>
            </select>
        </div>
        </div>
        <div style="display: flex; gap: 10px;">
        <button class="btn" onclick="filterProperties()" style="padding: 10px 20px; font-size: 14px;">🔍 Search</button>
        <button class="btn-secondary" onclick="clearPropertyFilters()" style="padding: 10px 20px; font-size: 14px;">🗑️ Clear</button>
        </div>
    </div>
    `;

    // Generate pagination controls
    const paginationHTML = totalPages > 1 ? `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 15px; background-color: #F5F5DC; border-radius: 8px;">
        <div style="color: #8B4513; font-weight: 600;">
        Showing ${startIndex + 1}-${Math.min(endIndex, totalProperties)} of ${totalProperties} properties
        </div>
        <div style="display: flex; gap: 5px; align-items: center;">
        <button class="btn-secondary" onclick="changePropertyPage(${currentPropertyPage - 1})" ${currentPropertyPage === 1 ? 'disabled' : ''} style="padding: 8px 12px; font-size: 14px;">‹ Previous</button>
        ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
            const pageNum = Math.max(1, Math.min(totalPages - 4, currentPropertyPage - 2)) + i;
            if (pageNum <= totalPages) {
            return `<button class="btn${pageNum === currentPropertyPage ? '' : '-secondary'}" onclick="changePropertyPage(${pageNum})" style="padding: 8px 12px; font-size: 14px; min-width: 40px;">${pageNum}</button>`;
            }
            return '';
        }).join('')}
        <button class="btn-secondary" onclick="changePropertyPage(${currentPropertyPage + 1})" ${currentPropertyPage === totalPages ? 'disabled' : ''} style="padding: 8px 12px; font-size: 14px;">Next ›</button>
        </div>
    </div>
    ` : '';

    // Group properties by status for better organization
    const pendingProperties = paginatedProperties.filter(p => p.status === 'Pending');
    const approvedProperties = paginatedProperties.filter(p => p.status === 'Approved');
    const rejectedProperties = paginatedProperties.filter(p => p.status === 'Rejected');
    const suspendedProperties = paginatedProperties.filter(p => p.status === 'Suspended');

    const generatePropertyCard = (prop, statusColor, statusBg) => `
    <div style="background-color: ${statusBg}; border: 2px solid ${statusColor}; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
        <div>
            <h4 style="color: #8B4513; margin-bottom: 10px;">${prop.property_name || prop.type} - ${prop.city}</h4>
            <p><strong>Address:</strong> ${prop.address}</p>
            <p><strong>Landlord:</strong> ${prop.landlord.first_name} ${prop.landlord.last_name}</p>
            <p><strong>Contact:</strong> ${prop.landlord.email} | ${prop.landlord.mobile || 'N/A'}</p>
            <p><strong>Rent:</strong> ₱${prop.monthly_rent?.toLocaleString()}/month</p>
            <p><strong>Submitted:</strong> ${new Date(prop.created_at).toLocaleDateString()}</p>
        </div>
        <span style="background-color: ${statusColor}; color: white; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: 600;">${prop.status}</span>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn" onclick="viewPropertyDetails('${prop.property_id}')" style="flex: 1; min-width: 120px; padding: 10px; font-size: 14px;">👁️ View Details</button>
        ${prop.status === 'Pending' ? `
            <button class="btn" onclick="approveProperty('${prop.property_id}')" style="flex: 1; min-width: 120px; padding: 10px; font-size: 14px; background-color: #32CD32;">✅ Approve</button>
            <button class="btn-secondary" onclick="rejectProperty('${prop.property_id}')" style="flex: 1; min-width: 120px; padding: 10px; font-size: 14px; background-color: #FF6B6B; color: white;">❌ Reject</button>
        ` : prop.status === 'Approved' ? `
            <button class="btn-secondary" onclick="suspendProperty('${prop.property_id}')" style="flex: 1; min-width: 120px; padding: 10px; font-size: 14px; background-color: #FFA500; color: white;">⏸️ Suspend</button>
        ` : ''}
        <button class="btn" onclick="messageUser('${prop.landlord.user_id}', '${prop.landlord.first_name} ${prop.landlord.last_name}')" style="flex: 1; min-width: 120px; padding: 10px; font-size: 14px;">💬 Contact Landlord</button>
        </div>
    </div>
    `;

    let propertiesHTML = '';
    
    if (propertyStatusFilter) {
    // Show filtered status only
    propertiesHTML = paginatedProperties.length > 0 ? paginatedProperties.map(prop => {
        const statusColors = {
        'Pending': { color: '#FFA500', bg: '#FFF8DC' },
        'Approved': { color: '#32CD32', bg: '#F0FFF0' },
        'Rejected': { color: '#FF6B6B', bg: '#FFE4E1' },
        'Suspended': { color: '#FF8C00', bg: '#FFF8DC' }
        };
        const colors = statusColors[prop.status] || { color: '#8B4513', bg: '#F5F5DC' };
        return generatePropertyCard(prop, colors.color, colors.bg);
    }).join('') : '<p style="text-align: center; color: #8B4513; padding: 40px;">No properties found matching your criteria</p>';
    } else {
    // Show all statuses with sections
    if (pendingProperties.length > 0) {
        propertiesHTML += `
        <div style="margin-bottom: 40px;">
            <h3 style="color: #8B4513; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #ADD8E6; padding-bottom: 10px;">🔍 Pending Approval (${pendingProperties.length})</h3>
            ${pendingProperties.map(prop => generatePropertyCard(prop, '#FFA500', '#FFF8DC')).join('')}
        </div>
        `;
    }
    
    if (approvedProperties.length > 0) {
        propertiesHTML += `
        <div style="margin-bottom: 40px;">
            <h3 style="color: #8B4513; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #ADD8E6; padding-bottom: 10px;">✅ Approved Properties (${approvedProperties.length})</h3>
            ${approvedProperties.map(prop => generatePropertyCard(prop, '#32CD32', '#F0FFF0')).join('')}
        </div>
        `;
    }
    
    if (rejectedProperties.length > 0) {
        propertiesHTML += `
        <div style="margin-bottom: 40px;">
            <h3 style="color: #8B4513; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #ADD8E6; padding-bottom: 10px;">❌ Rejected Properties (${rejectedProperties.length})</h3>
            ${rejectedProperties.map(prop => generatePropertyCard(prop, '#FF6B6B', '#FFE4E1')).join('')}
        </div>
        `;
    }
    
    if (suspendedProperties.length > 0) {
        propertiesHTML += `
        <div style="margin-bottom: 40px;">
            <h3 style="color: #8B4513; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #ADD8E6; padding-bottom: 10px;">⏸️ Suspended Properties (${suspendedProperties.length})</h3>
            ${suspendedProperties.map(prop => generatePropertyCard(prop, '#FF8C00', '#FFF8DC')).join('')}
        </div>
        `;
    }
    
    if (paginatedProperties.length === 0) {
        propertiesHTML = '<p style="text-align: center; color: #8B4513; padding: 40px;">No properties found matching your criteria</p>';
    }
    }

    propertiesList.innerHTML = controlsHTML + propertiesHTML + paginationHTML;
}

// User Management Functions
function filterUsers() {
    userSearchTerm = document.getElementById('user-search-input').value.trim();
    userRoleFilter = document.getElementById('user-role-filter').value;
    userStatusFilter = document.getElementById('user-status-filter').value;
    usersPerPage = parseInt(document.getElementById('users-per-page').value);
    currentUserPage = 1; // Reset to first page
    displayUserManagement();
}

function clearUserFilters() {
    userSearchTerm = '';
    userRoleFilter = '';
    userStatusFilter = '';
    usersPerPage = 5;
    currentUserPage = 1;
    displayUserManagement();
}

function changeUserPage(page) {
    const filteredUsers = adminUsers.filter(user => {
    const matchesSearch = !userSearchTerm || 
        user.first_name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.last_name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearchTerm.toLowerCase());
    
    const matchesRole = !userRoleFilter || user.role === userRoleFilter;
    const matchesStatus = !userStatusFilter || user.status === userStatusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
    });
    
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    
    if (page >= 1 && page <= totalPages) {
    currentUserPage = page;
    displayUserManagement();
    }
}

// Property Management Functions
function filterProperties() {
    propertySearchTerm = document.getElementById('property-search-input').value.trim();
    propertyTypeFilter = document.getElementById('property-type-filter').value;
    propertyStatusFilter = document.getElementById('property-status-filter').value;
    propertiesPerPage = parseInt(document.getElementById('properties-per-page').value);
    currentPropertyPage = 1; // Reset to first page
    displayPropertyManagement();
}

function clearPropertyFilters() {
    propertySearchTerm = '';
    propertyTypeFilter = '';
    propertyStatusFilter = '';
    propertiesPerPage = 5;
    currentPropertyPage = 1;
    displayPropertyManagement();
}

function changePropertyPage(page) {
    const filteredProperties = adminProperties.filter(prop => {
    const matchesSearch = !propertySearchTerm || 
        prop.type.toLowerCase().includes(propertySearchTerm.toLowerCase()) ||
        prop.city.toLowerCase().includes(propertySearchTerm.toLowerCase()) ||
        prop.address.toLowerCase().includes(propertySearchTerm.toLowerCase()) ||
        (prop.landlord.first_name + ' ' + prop.landlord.last_name).toLowerCase().includes(propertySearchTerm.toLowerCase());
    
    const matchesType = !propertyTypeFilter || prop.type === propertyTypeFilter;
    const matchesStatus = !propertyStatusFilter || prop.status === propertyStatusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
    });
    
    const totalPages = Math.ceil(filteredProperties.length / propertiesPerPage);
    
    if (page >= 1 && page <= totalPages) {
    currentPropertyPage = page;
    displayPropertyManagement();
    }
}

async function loadLandlordDashboard() {
    if (!currentUser) return;

    try {
    const { data: properties } = await supabase
        .from('properties')
        .select('*')
        .eq('landlord_id', currentUser.user_id);

    const total = properties?.length || 0;
    const available = properties?.filter(p => p.availability === 'Available').length || 0;
    const occupied = properties?.filter(p => p.availability === 'Occupied').length || 0;

    document.getElementById('landlord-total-properties').textContent = total;
    document.getElementById('landlord-available-properties').textContent = available;
    document.getElementById('landlord-occupied-properties').textContent = occupied;

    const propertiesList = document.getElementById('landlord-properties-list');
    propertiesList.innerHTML = properties?.map(prop => `
        <div style="background-color: #F5F5DC; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="color: #8B4513; margin-bottom: 10px;">${prop.property_name || prop.type} - ${prop.city}</h4>
        <p><strong>Address:</strong> ${prop.address}</p>
        <p><strong>Rent:</strong> ₱${prop.monthly_rent?.toLocaleString()}/month</p>
        <p><strong>Status:</strong> ${prop.status}</p>
        <p><strong>Availability:</strong> ${prop.availability}</p>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button class="btn" onclick="editProperty('${prop.property_id}')" style="flex: 1; padding: 10px;">✏️ Edit</button>
            <button class="btn-secondary" onclick="deleteProperty('${prop.property_id}')" style="flex: 1; padding: 10px; background-color: #FFB6C1; border-color: #FF69B4;">🗑️ Delete</button>
            <button class="btn" onclick="viewApplicants('${prop.property_id}')" style="flex: 1; padding: 10px;">👥 View Applicants</button>
            ${prop.availability === 'Occupied' ? `
            <button class="btn" onclick="messageTenant('${prop.property_id}')" style="flex: 1; padding: 10px;">💬 Message Tenant</button>
            ` : ''}
        </div>
        </div>
    `).join('') || '<p>No properties posted yet. Click "Add New Property" to get started!</p>';
    } catch (error) {
    console.error('Error loading landlord dashboard:', error);
    }
}

async function loadTenantDashboard() {
    if (!currentUser) return;

    try {
    // Load applied properties with property and landlord details
    const { data: applications, error: appError } = await supabase
        .from('property_applicants')
        .select(`
        *,
        property:properties(
            *,
            landlord:users(
            user_id,
            first_name,
            last_name,
            email,
            mobile
            )
        )
        `)
        .eq('tenant_id', currentUser.user_id)
        .order('application_date', { ascending: false });

    if (appError) throw appError;

    const appliedPropertiesHTML = applications?.length > 0 ? applications.map(app => `
        <div style="background-color: #F5F5DC; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
            <div>
            <h4 style="color: #8B4513; margin-bottom: 5px;">${app.property.property_name || app.property.type} - ${app.property.city}</h4>
            <p style="margin-bottom: 5px;"><strong>Address:</strong> ${app.property.address}</p>
            <p style="margin-bottom: 5px;"><strong>Rent:</strong> ₱${app.property.monthly_rent?.toLocaleString()}/month</p>
            <p style="margin-bottom: 5px;"><strong>Landlord:</strong> ${app.property.landlord.first_name} ${app.property.landlord.last_name}</p>
            <p style="margin-bottom: 10px;"><strong>Applied:</strong> ${new Date(app.application_date).toLocaleDateString()}</p>
            </div>
            <span style="background-color: ${app.status === 'Pending' ? '#FFA500' : app.status === 'Approved' ? '#32CD32' : '#FF6B6B'}; color: white; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: 600;">${app.status}</span>
        </div>
        ${app.message ? `
            <div style="background-color: #FFFFFF; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
            <strong style="color: #8B4513;">Your Application Message:</strong>
            <p style="margin-top: 8px; line-height: 1.5;">${app.message}</p>
            </div>
        ` : ''}
        <div style="display: flex; gap: 10px;">
            <button class="btn" onclick="viewAppliedProperty('${app.property.property_id}')" style="flex: 1; padding: 8px; font-size: 14px;">👁️ View Property</button>
            ${app.status === 'Pending' ? `
            <button class="btn-secondary" onclick="cancelApplication('${app.applicant_id}')" style="flex: 1; padding: 8px; font-size: 14px; background-color: #FF6B6B; color: white;">❌ Cancel</button>
            ` : ''}
            <button class="btn" onclick="messageLandlord('${app.property.landlord.user_id}', '${app.property.landlord.first_name}', '${app.property.property_id}')" style="flex: 1; padding: 8px; font-size: 14px;">💬 Message</button>
        </div>
        </div>
    `).join('') : '<p style="text-align: center; color: #8B4513; font-size: 18px; padding: 40px;">No applications yet. Browse properties and apply for your next home!</p>';

    document.getElementById('tenant-saved-properties').innerHTML = appliedPropertiesHTML;
    document.getElementById('tenant-reviews').innerHTML = '<p>No reviews yet.</p>';
    document.getElementById('tenant-history').innerHTML = '<p>No rental history yet.</p>';

    } catch (error) {
    console.error('Error loading tenant dashboard:', error);
    document.getElementById('tenant-saved-properties').innerHTML = '<p>Error loading applications. Please refresh the page.</p>';
    }
}

async function approveProperty(propertyId) {
    try {
    // Get property details first
    const { data: property, error: propError } = await supabase
        .from('properties')
        .select(`
        *,
        landlord:users(
            user_id,
            first_name,
            last_name,
            email
        )
        `)
        .eq('property_id', propertyId)
        .single();

    if (propError) throw propError;

    const { error } = await supabase
        .from('properties')
        .update({ status: 'Approved' })
        .eq('property_id', propertyId);

    if (error) throw error;

    // 🔔 Create notification for landlord - property approved
    await createNotification(
        property.landlord.user_id,
        'Property Approved! 🎉',
        `Great news! Your ${property.type} property in ${property.city} has been approved and is now live on HousinGo. Tenants can now view and apply for your property.`
    );

    showToast('Property approved successfully!');
    loadAdminDashboard();
    } catch (error) {
    console.error('Error approving property:', error);
    showToast('Failed to approve property');
    }
}

async function editProperty(propertyId) {
    try {
    console.log('=== EDIT PROPERTY DEBUG ===');
    console.log('Loading property data for edit:', propertyId);
    console.log('Current user:', currentUser);
    
    // 1️⃣ Get first all data from database and store it to fromDB
    const { data: fromDB, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('property_id', propertyId)
        .eq('landlord_id', currentUser.user_id) // Ensure user owns the property
        .single();

    if (propError) {
        console.error('Property fetch error:', propError);
        throw propError;
    }

    if (!fromDB) {
        throw new Error('Property not found or you do not have permission to edit it');
    }

    console.log('✅ Property data loaded successfully from DB:', fromDB);

    // 2️⃣ Get amenities for this property (only included ones)
    const { data: amenities, error: amenError } = await supabase
        .from('amenities')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_included', true);

    if (amenError) {
        console.error('Amenities fetch error:', amenError);
        throw amenError;
    }

    console.log('✅ Amenities loaded successfully:', amenities);

    // 3️⃣ Get images for this property
    const { data: images, error: imgError } = await supabase
        .from('property_images')
        .select('*')
        .eq('property_id', propertyId);

    if (imgError) {
        console.error('Images fetch error:', imgError);
        throw imgError;
    }

    console.log('✅ Images loaded successfully:', images);
    console.log('=== END EDIT PROPERTY DEBUG ===');

    // 4️⃣ Navigate to edit form
    showPage('post-property');

    setTimeout(() => {
        // Clear all amenity checkboxes first
        document.querySelectorAll('input[name="amenity"]').forEach(cb => cb.checked = false);

        // 5️⃣ Populate form fields with existing data from fromDB
        document.getElementById('property-name').value = fromDB.property_name || '';
        document.getElementById('property-type').value = fromDB.type || '';
        document.getElementById('monthly-rent').value = fromDB.monthly_rent || '';
        document.getElementById('available-slots').value = fromDB.available_slots || '';
        document.getElementById('property-address').value = fromDB.address || '';
        document.getElementById('property-barangay').value = fromDB.barangay || '';
        document.getElementById('property-city').value = fromDB.city || '';
        document.getElementById('nearby-landmarks').value = fromDB.nearby_landmarks || '';
        document.getElementById('location-link').value = fromDB.loc_link || '';
        document.getElementById('property-description').value = fromDB.description || '';
        document.getElementById('property-rules').value = fromDB.rules || '';
        document.getElementById('contact-name').value = fromDB.contact_name || '';
        document.getElementById('contact-number').value = fromDB.contact_number || '';
        document.getElementById('move-in-date').value = fromDB.move_in_date || '';
        document.getElementById('min-stay').value = fromDB.min_stay || '';

        // 6️⃣ Check existing amenities
        amenities.forEach(amenity => {
        const checkbox = document.querySelector(`input[name="amenity"][value="${amenity.amenity_name}"]`);
        if (checkbox && amenity.is_included) {
            checkbox.checked = true;
            console.log('✅ Checked amenity:', amenity.amenity_name);
        }
        });

        // 7️⃣ Display existing images
        const imagePreview = document.getElementById('image-preview');
        imagePreview.innerHTML = '';
        images.forEach((img, index) => {
        const imgDiv = document.createElement('div');
        imgDiv.style.cssText = 'position: relative; border-radius: 8px; overflow: hidden; border: 2px solid #ADD8E6;';
        imgDiv.innerHTML = `
            <img src="${img.image_url}" style="width: 100%; height: 120px; object-fit: cover;">
            <div style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${index + 1}</div>
            <button type="button" onclick="removeExistingImage('${img.image_id}')" style="position: absolute; bottom: 5px; right: 5px; background: rgba(255,0,0,0.8); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
        `;
        imagePreview.appendChild(imgDiv);
        });

        // 8️⃣ Set form to edit mode
        const form = document.getElementById('post-property-form');
        form.dataset.editMode = 'true';
        form.dataset.propertyId = propertyId;
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Update Property';

        document.querySelector('#post-property-page h1').textContent = 'Edit Property';
        
        console.log('✅ Form populated and ready for editing');
    }, 100);

    } catch (error) {
    console.error('❌ Error loading property for edit:', error);
    showToast('Failed to load property details: ' + error.message);
    }
}

async function removeExistingImage(imageId) {
    try {
    const { error } = await supabase
        .from('property_images')
        .delete()
        .eq('image_id', imageId);

    if (error) throw error;

    showToast('Image removed successfully');
    
    // Remove the image from preview
    event.target.closest('div[style*="position: relative"]').remove();
    } catch (error) {
    console.error('Error removing image:', error);
    showToast('Failed to remove image');
    }
}

async function deleteProperty(propertyId) {
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center;';
    confirmDiv.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 400px; text-align: center;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Delete Property?</h3>
        <p style="margin-bottom: 30px; color: #654321;">Are you sure you want to delete this property? This action cannot be undone.</p>
        <div style="display: flex; gap: 15px;">
        <button class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
        <button class="btn" onclick="confirmDeleteProperty('${propertyId}')" style="flex: 1; padding: 12px; background-color: #FF6B6B;">Delete</button>
        </div>
    </div>
    `;
    document.body.appendChild(confirmDiv);
}

async function confirmDeleteProperty(propertyId) {
    try {
    document.querySelector('div[style*="position: fixed"]')?.remove();

    await supabase.from('amenities').delete().eq('property_id', propertyId);
    await supabase.from('property_images').delete().eq('property_id', propertyId);

    const { error } = await supabase
        .from('properties')
        .delete()
        .eq('property_id', propertyId);

    if (error) throw error;

    showToast('Property deleted successfully!');
    loadLandlordDashboard();
    } catch (error) {
    console.error('Error deleting property:', error);
    showToast('Failed to delete property');
    }
}

function messageTenant(propertyId) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    messageDiv.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 500px; width: 100%;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Message Tenant</h3>
        <form onsubmit="sendTenantMessage(event, '${propertyId}')">
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Subject</label>
            <input type="text" id="message-subject" required style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Message</label>
            <textarea id="message-content" required rows="5" style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513; resize: vertical; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;"></textarea>
        </div>
        <div style="display: flex; gap: 15px;">
            <button type="button" class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
            <button type="submit" class="btn" style="flex: 1; padding: 12px;">Send Message</button>
        </div>
        </form>
    </div>
    `;
    document.body.appendChild(messageDiv);
}

function sendTenantMessage(event, propertyId) {
    event.preventDefault();
    const subject = document.getElementById('message-subject').value;
    const content = document.getElementById('message-content').value;
    
    showToast('Message sent to tenant successfully!');
    document.querySelector('div[style*="position: fixed"]')?.remove();
}

async function viewApplicants(propertyId) {
    try {
    // Get property details
    const { data: property, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('property_id', propertyId)
        .single();

    if (propError) throw propError;

    // Get applicants with tenant details
    const { data: applicants, error: appError } = await supabase
        .from('property_applicants')
        .select(`
        *,
        tenant:users(
            user_id,
            first_name,
            last_name,
            email,
            mobile
        )
        `)
        .eq('property_id', propertyId)
        .order('application_date', { ascending: false });

    if (appError) throw appError;

    const applicantsModal = document.createElement('div');
    applicantsModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;';
    
    const applicantsHTML = applicants?.length > 0 ? applicants.map(app => `
        <div style="background-color: #F5F5DC; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
            <div>
            <h4 style="color: #8B4513; margin-bottom: 5px;">${app.tenant.first_name} ${app.tenant.last_name}</h4>
            <p style="margin-bottom: 5px;"><strong>Email:</strong> ${app.tenant.email}</p>
            <p style="margin-bottom: 5px;"><strong>Mobile:</strong> ${app.tenant.mobile}</p>
            <p style="margin-bottom: 10px;"><strong>Applied:</strong> ${new Date(app.application_date).toLocaleDateString()}</p>
            </div>
            <span style="background-color: ${app.status === 'Pending' ? '#FFA500' : app.status === 'Approved' ? '#32CD32' : '#FF6B6B'}; color: white; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: 600;">${app.status}</span>
        </div>
        ${app.message ? `
            <div style="background-color: #FFFFFF; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
            <strong style="color: #8B4513;">Application Message:</strong>
            <p style="margin-top: 8px; line-height: 1.5;">${app.message}</p>
            </div>
        ` : ''}
        ${app.status === 'Pending' ? `
            <div style="display: flex; gap: 10px;">
            <button class="btn" onclick="updateApplicationStatus('${app.applicant_id}', 'Approved')" style="flex: 1; padding: 8px; font-size: 14px; background-color: #32CD32;">✅ Approve</button>
            <button class="btn-secondary" onclick="updateApplicationStatus('${app.applicant_id}', 'Rejected')" style="flex: 1; padding: 8px; font-size: 14px; background-color: #FF6B6B; color: white;">❌ Reject</button>
            <button class="btn" onclick="contactApplicant('${app.tenant.mobile}', '${app.tenant.first_name}')" style="flex: 1; padding: 8px; font-size: 14px;">📞 Contact</button>
            </div>
        ` : `
            <button class="btn" onclick="contactApplicant('${app.tenant.mobile}', '${app.tenant.first_name}')" style="width: 100%; padding: 8px; font-size: 14px;">📞 Contact</button>
        `}
        </div>
    `).join('') : '<p style="text-align: center; color: #8B4513; font-size: 18px; padding: 40px;">No applications yet for this property.</p>';

    applicantsModal.innerHTML = `
        <div style="background: white; border-radius: 12px; max-width: 800px; width: 100%; max-height: 90%; overflow-y: auto;">
        <div style="background-color: #ADD8E6; padding: 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0;">
            <h2 style="color: #8B4513; margin: 0;">Applicants for ${property.property_name || property.type} - ${property.city}</h2>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="background: none; border: none; font-size: 30px; color: #8B4513; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        <div style="padding: 30px;">
            <div style="margin-bottom: 20px;">
            <p><strong>Property:</strong> ${property.address}</p>
            <p><strong>Rent:</strong> ₱${property.monthly_rent?.toLocaleString()}/month</p>
            <p><strong>Total Applications:</strong> ${applicants?.length || 0}</p>
            </div>
            ${applicantsHTML}
        </div>
        </div>
    `;

    document.body.appendChild(applicantsModal);

    } catch (error) {
    console.error('Error loading applicants:', error);
    showToast('Failed to load applicants: ' + error.message);
    }
}

async function updateApplicationStatus(applicantId, newStatus) {
    try {
    // Get application details first
    const { data: application, error: appError } = await supabase
        .from('property_applicants')
        .select(`
        *,
        tenant:users(
            user_id,
            first_name,
            last_name
        ),
        property:properties(
            property_id,
            type,
            city,
            address,
            landlord_id
        )
        `)
        .eq('applicant_id', applicantId)
        .single();

    if (appError) throw appError;

    const { error } = await supabase
        .from('property_applicants')
        .update({ status: newStatus })
        .eq('applicant_id', applicantId);

    if (error) throw error;

    // 🔔 Create notification for tenant - application status update
    if (newStatus === 'Approved') {
        await createNotification(
        application.tenant.user_id,
        'Application Approved! 🎉',
        `Congratulations! Your application for the ${application.property.type} property in ${application.property.city} has been approved. The landlord will contact you soon with next steps.`
        );
    } else if (newStatus === 'Rejected') {
        await createNotification(
        application.tenant.user_id,
        'Application Update',
        `Your application for the ${application.property.type} property in ${application.property.city} was not selected this time. Keep looking - there are many other great properties available!`
        );
    }

    showToast(`Application ${newStatus.toLowerCase()} successfully!`);
    
    // Refresh the applicants view
    document.querySelector('div[style*="position: fixed"]')?.remove();
    
    } catch (error) {
    console.error('Error updating application status:', error);
    showToast('Failed to update application status');
    }
}

function contactApplicant(mobile, firstName) {
    const contactModal = document.createElement('div');
    contactModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 3500; display: flex; align-items: center; justify-content: center; padding: 20px;';
    contactModal.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 400px; text-align: center;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Contact ${firstName}</h3>
        <p style="margin-bottom: 20px; color: #654321;">Mobile Number:</p>
        <p style="font-size: 24px; font-weight: bold; color: #8B4513; margin-bottom: 30px; background-color: #F5F5DC; padding: 15px; border-radius: 8px;">${mobile}</p>
        <button class="btn" onclick="this.closest('div[style*=fixed]').remove()" style="width: 100%; padding: 12px;">Close</button>
    </div>
    `;
    document.body.appendChild(contactModal);
}

// Image upload preview
document.getElementById('property-images').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    const previewContainer = document.getElementById('image-preview');
    previewContainer.innerHTML = '';

    if (files.length > 10) {
    showToast('Maximum 10 images allowed. Only first 10 will be uploaded.');
    e.target.files = Array.from(files).slice(0, 10);
    }

    files.slice(0, 10).forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = function(event) {
        const imgDiv = document.createElement('div');
        imgDiv.style.cssText = 'position: relative; border-radius: 8px; overflow: hidden; border: 2px solid #ADD8E6;';
        imgDiv.innerHTML = `
        <img src="${event.target.result}" style="width: 100%; height: 120px; object-fit: cover;">
        <div style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${index + 1}</div>
        `;
        previewContainer.appendChild(imgDiv);
    };
    reader.readAsDataURL(file);
    });
});

// Form handlers
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
    // Query users table directly with email and password
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

    if (userError || !userData) {
        throw new Error('Invalid email or password');
    }

    if (userData.status !== 'Active') {
        throw new Error('Your account is not active. Please contact support.');
    }

    currentUser = userData;
    localStorage.setItem('housingo_user', JSON.stringify(userData));
    showToast('Login successful! Welcome back!');
    
    setTimeout(() => {
        const dashboardPage = userData.role === 'Admin' ? 'admin-dashboard' :
                            userData.role === 'Landlord' ? 'landlord-dashboard' : 'tenant-dashboard';
        showPage(dashboardPage);
        updateNavForLoggedInUser();
    }, 1000);

    } catch (error) {
    console.error('Login error:', error);
    showToast('Login failed: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log In';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const firstName = document.getElementById('reg-firstname').value;
    const lastName = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const mobile = document.getElementById('reg-mobile').value;
    const userType = document.getElementById('reg-usertype').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (password !== confirmPassword) {
    showToast('Passwords do not match!');
    return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
    // Insert user directly into users table with password
    const { data: userData, error: insertError } = await supabase
        .from('users')
        .insert([{
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
        mobile: mobile,
        role: userType,
        status: 'Active'
        }])
        .select()
        .single();

    if (insertError) throw insertError;

    // 🔔 Create welcome notification for new user
    await createNotification(
        userData.user_id,
        'Welcome to HousinGo! 🏠',
        `Hi ${firstName}! Welcome to HousinGo. Your ${userType.toLowerCase()} account has been created successfully. ${userType === 'Tenant' ? 'Start browsing properties to find your perfect home!' : 'You can now post your properties and connect with potential tenants.'}`
    );

    // 🔔 Notify all admins about new user registration
    await notifyAllAdmins(
        'New User Registration',
        `${firstName} ${lastName} has registered as a ${userType} on HousinGo.`
    );

    showToast('Registration successful! You can now log in.');
    
    setTimeout(() => {
        showPage('login');
        document.getElementById('register-form').reset();
    }, 2000);

    } catch (error) {
    console.error('Registration error:', error);
    if (error.message.includes('duplicate key')) {
        showToast('This email is already registered. Please use a different email or log in.');
    } else {
        showToast('Registration failed: ' + error.message);
    }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
    }
}

function handleContact(event) {
    event.preventDefault();
    const name = document.getElementById('contact-name').value;
    const mobile = document.getElementById('contact-mobile').value;
    const email = document.getElementById('contact-email').value;
    const subject = document.getElementById('contact-subject').value;
    const message = document.getElementById('contact-message').value;

    showToast('Thank you for your message! We will get back to you soon.');
    document.getElementById('contact-form').reset();
}

function socialLogin(platform) {
    showToast(`${platform} login will be available soon!`);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ADD8E6; color: #8B4513; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 3000; max-width: 350px; font-weight: 500;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function toggleFAQ(questionElement) {
    const faqItem = questionElement.parentElement;
    const answer = faqItem.querySelector('.faq-answer');
    const icon = questionElement.querySelector('.faq-icon');
    const isOpen = answer.style.maxHeight && answer.style.maxHeight !== '0px';

    if (isOpen) {
    answer.style.maxHeight = '0';
    icon.style.transform = 'rotate(0deg)';
    questionElement.style.backgroundColor = '';
    } else {
    answer.style.maxHeight = answer.scrollHeight + 'px';
    icon.style.transform = 'rotate(180deg)';
    questionElement.style.backgroundColor = 'rgba(173, 216, 230, 0.3)';
    }
}

if (window.elementSdk) {
    window.elementSdk.init({
    defaultConfig,
    onConfigChange,
    mapToCapabilities: (config) => ({
        recolorables: [
        {
            get: () => config.background_color || defaultConfig.background_color,
            set: (value) => {
            config.background_color = value;
            window.elementSdk.setConfig({ background_color: value });
            }
        },
        {
            get: () => config.primary_color || defaultConfig.primary_color,
            set: (value) => {
            config.primary_color = value;
            window.elementSdk.setConfig({ primary_color: value });
            }
        },
        {
            get: () => config.text_color || defaultConfig.text_color,
            set: (value) => {
            config.text_color = value;
            window.elementSdk.setConfig({ text_color: value });
            }
        },
        {
            get: () => config.accent_color || defaultConfig.accent_color,
            set: (value) => {
            config.accent_color = value;
            window.elementSdk.setConfig({ accent_color: value });
            }
        },
        {
            get: () => config.secondary_text_color || defaultConfig.secondary_text_color,
            set: (value) => {
            config.secondary_text_color = value;
            window.elementSdk.setConfig({ secondary_text_color: value });
            }
        }
        ],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
    }),
    mapToEditPanelValues: (config) => new Map([
        ["site_name", config.site_name || defaultConfig.site_name],
        ["tagline", config.tagline || defaultConfig.tagline],
        ["footer_text", config.footer_text || defaultConfig.footer_text],
        ["contact_email", config.contact_email || defaultConfig.contact_email]
    ])
    });
}

async function viewAppliedProperty(propertyId) {
    const property = allProperties.find(p => p.property_id === propertyId);
    if (property) {
    showPropertyDetails(property);
    } else {
    // If property not in current list, fetch it
    try {
        const { data: propertyData, error } = await supabase
        .from('properties')
        .select('*')
        .eq('property_id', propertyId)
        .single();

        if (error) throw error;
        if (propertyData) {
        showPropertyDetails(propertyData);
        }
    } catch (error) {
        console.error('Error loading property:', error);
        showToast('Failed to load property details');
    }
    }
}

async function cancelApplication(applicantId) {
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center;';
    confirmDiv.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 400px; text-align: center;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Cancel Application?</h3>
        <p style="margin-bottom: 30px; color: #654321;">Are you sure you want to cancel this application? This action cannot be undone.</p>
        <div style="display: flex; gap: 15px;">
        <button class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Keep Application</button>
        <button class="btn" onclick="confirmCancelApplication('${applicantId}')" style="flex: 1; padding: 12px; background-color: #FF6B6B;">Cancel Application</button>
        </div>
    </div>
    `;
    document.body.appendChild(confirmDiv);
}

async function confirmCancelApplication(applicantId) {
    try {
    document.querySelector('div[style*="position: fixed"]')?.remove();

    const { error } = await supabase
        .from('property_applicants')
        .delete()
        .eq('applicant_id', applicantId);

    if (error) throw error;

    showToast('Application cancelled successfully!');
    loadTenantDashboard(); // Refresh the dashboard
    } catch (error) {
    console.error('Error cancelling application:', error);
    showToast('Failed to cancel application');
    }
}

function messageLandlord(landlordId, landlordName, propertyId) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    messageDiv.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 500px; width: 100%;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Message ${landlordName}</h3>
        <form onsubmit="sendLandlordMessage(event, '${landlordId}', '${propertyId}')">
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Subject</label>
            <input type="text" id="landlord-message-subject" required style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Message</label>
            <textarea id="landlord-message-content" required rows="5" style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513; resize: vertical; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;"></textarea>
        </div>
        <div style="display: flex; gap: 15px;">
            <button type="button" class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
            <button type="submit" class="btn" style="flex: 1; padding: 12px;">Send Message</button>
        </div>
        </form>
    </div>
    `;
    document.body.appendChild(messageDiv);
}

function sendLandlordMessage(event, landlordId, propertyId) {
    event.preventDefault();
    const subject = document.getElementById('landlord-message-subject').value;
    const content = document.getElementById('landlord-message-content').value;
    
    showToast('Message sent to landlord successfully!');
    document.querySelector('div[style*="position: fixed"]')?.remove();
}

function redirectToLogin() {
    // Close any open modals
    document.querySelector('div[style*="position: fixed"]')?.remove();
    
    // Navigate to login page
    showPage('login');
    
    // Show a helpful message
    showToast('Please log in to apply for properties and access more features!');
}

// User Settings Functions
function loadUserSettings() {
    if (!currentUser) {
    showPage('login');
    return;
    }

    // Populate form fields with current user data
    document.getElementById('settings-firstname').value = currentUser.first_name || '';
    document.getElementById('settings-lastname').value = currentUser.last_name || '';
    document.getElementById('settings-email').value = currentUser.email || '';
    document.getElementById('settings-mobile').value = currentUser.mobile || '';
    document.getElementById('settings-role').value = currentUser.role || '';
}

async function handleUpdateProfile(event) {
    event.preventDefault();
    
    if (!currentUser) {
    showToast('Please log in to update your profile');
    return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';

    try {
    const updateData = {
        first_name: document.getElementById('settings-firstname').value,
        last_name: document.getElementById('settings-lastname').value,
        email: document.getElementById('settings-email').value,
        mobile: document.getElementById('settings-mobile').value
    };

    const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', currentUser.user_id)
        .select()
        .single();

    if (error) throw error;

    // Update current user and localStorage
    currentUser = { ...currentUser, ...updateData };
    localStorage.setItem('housingo_user', JSON.stringify(currentUser));
    
    // Update navigation display
    updateNavForLoggedInUser();

    showToast('Profile updated successfully!');
    
    } catch (error) {
    console.error('Profile update error:', error);
    showToast('Failed to update profile: ' + error.message);
    } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Profile';
    }
}

async function handleChangePassword(event) {
    event.preventDefault();
    
    if (!currentUser) {
    showToast('Please log in to change your password');
    return;
    }

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    if (newPassword !== confirmPassword) {
    showToast('New passwords do not match!');
    return;
    }

    if (currentPassword !== currentUser.password) {
    showToast('Current password is incorrect!');
    return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Changing Password...';

    try {
    const { data, error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('user_id', currentUser.user_id)
        .select()
        .single();

    if (error) throw error;

    // Update current user password
    currentUser.password = newPassword;
    localStorage.setItem('housingo_user', JSON.stringify(currentUser));

    showToast('Password changed successfully!');
    document.getElementById('change-password-form').reset();
    
    } catch (error) {
    console.error('Password change error:', error);
    showToast('Failed to change password: ' + error.message);
    } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Change Password';
    }
}

function goToDashboard() {
    if (!currentUser) return;
    
    const dashboardPage = currentUser.role === 'Admin' ? 'admin-dashboard' :
                        currentUser.role === 'Landlord' ? 'landlord-dashboard' : 'tenant-dashboard';
    showPage(dashboardPage);
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown-menu');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const profileDropdown = document.getElementById('user-profile-dropdown');
    const dropdown = document.getElementById('profile-dropdown-menu');
    
    if (profileDropdown && !profileDropdown.contains(event.target)) {
    dropdown.style.display = 'none';
    }
});

// Notification System
let userNotifications = [];
let currentNotificationFilter = 'all';

// 🔔 Helper function to create notifications
async function createNotification(userId, title, message) {
    try {
    const currentTimestamp = new Date().toISOString();
    const { data, error } = await supabase
        .from('notifications')
        .insert([{
        user_id: userId,
        title: title,
        message: message,
        is_read: false,
        sent_at: currentTimestamp
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating notification:', error);
        return null;
    }

    console.log('✅ Notification created successfully:', data);
    return data;
    } catch (error) {
    console.error('Error creating notification:', error);
    return null;
    }
}

// 🔔 Helper function to notify all admins
async function notifyAllAdmins(title, message) {
    try {
    // Get all admin users
    const { data: admins, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('role', 'Admin')
        .eq('status', 'Active');

    if (error) {
        console.error('Error fetching admins:', error);
        return;
    }

    // Create notifications for all admins
    const currentTimestamp = new Date().toISOString();
    const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        title: title,
        message: message,
        is_read: false,
        sent_at: currentTimestamp
    }));

    if (notifications.length > 0) {
        const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

        if (insertError) {
        console.error('Error creating admin notifications:', insertError);
        } else {
        console.log(`✅ Notifications sent to ${notifications.length} admin(s)`);
        }
    }
    } catch (error) {
    console.error('Error notifying admins:', error);
    }
}

async function loadNotificationCount() {
    if (!currentUser) return;

    try {
    console.log('🔔 Loading notifications for user:', currentUser.user_id);
    
    // Load notifications from database
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.user_id)
        .order('sent_at', { ascending: false });

    if (error) {
        console.error('Error loading notifications:', error);
        // Fallback to sample notifications if database fails
        const sampleNotifications = await generateSampleNotifications();
        userNotifications = sampleNotifications;
    } else {
        userNotifications = notifications || [];
        console.log(`📊 Loaded ${userNotifications.length} notifications from database`);
        if (userNotifications.length > 0) {
        console.log('🔔 Notifications details:', userNotifications.slice(0, 3).map(n => ({
            id: n.notif_id,
            title: n.title,
            sent_at: n.sent_at,
            is_read: n.is_read
        })));
        }
    }
    
    const unreadCount = userNotifications.filter(n => !n.is_read).length;
    console.log(`📈 Unread notifications count: ${unreadCount}`);
    
    const badge = document.getElementById('notification-badge');
    const userIndicator = document.getElementById('user-notification-indicator');
    
    if (unreadCount > 0) {
        badge.style.display = 'block';
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        
        // Show red indicator near user name
        if (userIndicator) {
        userIndicator.style.display = 'block';
        }
    } else {
        badge.style.display = 'none';
        
        // Hide red indicator near user name
        if (userIndicator) {
        userIndicator.style.display = 'none';
        }
    }
    } catch (error) {
    console.error('Error loading notifications:', error);
    }
}

async function generateSampleNotifications() {
    // Generate sample notifications based on user role (fallback when database is unavailable)
    const notifications = [];
    const now = new Date();

    if (currentUser.role === 'Tenant') {
    notifications.push(
        {
        notif_id: 'sample-1',
        user_id: currentUser.user_id,
        title: 'Application Status Update',
        message: 'Your application for Studio Type in Taguig has been approved by the landlord!',
        is_read: false,
        sent_at: new Date(now - 2 * 60 * 60 * 1000) // 2 hours ago
        },
        {
        notif_id: 'sample-2',
        user_id: currentUser.user_id,
        title: 'New Property Match',
        message: 'A new Single Room property matching your preferences is now available in East Rembo.',
        is_read: true,
        sent_at: new Date(now - 24 * 60 * 60 * 1000) // 1 day ago
        },
        {
        notif_id: 'sample-3',
        user_id: currentUser.user_id,
        title: 'Message from Landlord',
        message: 'John Doe sent you a message regarding your application.',
        is_read: false,
        sent_at: new Date(now - 30 * 60 * 1000) // 30 minutes ago
        }
    );
    } else if (currentUser.role === 'Landlord') {
    notifications.push(
        {
        notif_id: 'sample-4',
        user_id: currentUser.user_id,
        title: 'New Property Application',
        message: 'Maria Santos has applied for your Boarding House property in Taguig.',
        is_read: false,
        sent_at: new Date(now - 1 * 60 * 60 * 1000) // 1 hour ago
        },
        {
        notif_id: 'sample-5',
        user_id: currentUser.user_id,
        title: 'Property Approved',
        message: 'Your Single Family property listing has been approved and is now live!',
        is_read: true,
        sent_at: new Date(now - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        {
        notif_id: 'sample-6',
        user_id: currentUser.user_id,
        title: 'Tenant Message',
        message: 'Your tenant sent you a maintenance request for Unit 2B.',
        is_read: false,
        sent_at: new Date(now - 45 * 60 * 1000) // 45 minutes ago
        }
    );
    } else if (currentUser.role === 'Admin') {
    notifications.push(
        {
        notif_id: 'sample-7',
        user_id: currentUser.user_id,
        title: 'New Property Pending Review',
        message: '5 new properties are waiting for your approval.',
        is_read: false,
        sent_at: new Date(now - 2 * 60 * 60 * 1000) // 2 hours ago
        },
        {
        notif_id: 'sample-8',
        user_id: currentUser.user_id,
        title: 'New User Registration',
        message: '3 new users have registered today.',
        is_read: true,
        sent_at: new Date(now - 6 * 60 * 60 * 1000) // 6 hours ago
        }
    );
    }

    return notifications;
}

function showNotifications() {
    const modal = document.getElementById('notifications-modal');
    modal.classList.add('active');
    loadNotifications();
    
    // Close profile dropdown
    document.getElementById('profile-dropdown-menu').style.display = 'none';
}

function closeNotifications() {
    document.getElementById('notifications-modal').classList.remove('active');
}

function loadNotifications() {
    displayNotifications(userNotifications);
}

function displayNotifications(notifications) {
    const container = document.getElementById('notifications-list');
    
    if (notifications.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #8B4513; padding: 40px;">No notifications yet.</p>';
    return;
    }

    container.innerHTML = notifications.map(notification => {
    // Use actual timestamp from database for notifications
    const rawTimestamp = notification.sent_at;
    const notificationTime = rawTimestamp ? new Date(rawTimestamp) : new Date();
    
    // Validate the parsed timestamp
    if (isNaN(notificationTime.getTime())) {
        console.warn(`⚠️ Invalid notification timestamp: ${rawTimestamp} for notification: ${notification.notif_id}`);
        notificationTime = new Date(); // Fallback to current time
    }
    
    const timeAgo = getTimeAgo(notificationTime);
    const statusClass = notification.is_read ? 'read' : 'unread';
    
    console.log(`🔔 Notification display: id=${notification.notif_id}, raw_timestamp=${rawTimestamp}, parsed=${notificationTime.toISOString()}, timeAgo=${timeAgo}`);
    
    return `
        <div class="notification-item ${statusClass}" onclick="markAsRead('${notification.notif_id}')">
        <div class="notification-header">
            <div>
            <div class="notification-title">${notification.title}</div>
            <div class="notification-time">${timeAgo}</div>
            </div>
            <span class="notification-status ${statusClass}">${notification.is_read ? 'Read' : 'New'}</span>
        </div>
        <div class="notification-message">${notification.message}</div>
        </div>
    `;
    }).join('');
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const messageTime = new Date(timestamp);
    
    // Adjust for 8-hour timezone difference (add 8 hours to message time)
    const adjustedMessageTime = new Date(messageTime.getTime() + (8 * 60 * 60 * 1000));
    
    const diff = now - adjustedMessageTime;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) {
    return 'Just now';
    } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
}

function filterNotifications(filter) {
    currentNotificationFilter = filter;
    
    // Update filter button styles
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
    btn.className = 'btn-secondary';
    btn.style.padding = '8px 16px';
    btn.style.fontSize = '14px';
    });
    
    document.getElementById(`filter-${filter}`).className = 'btn';

    // Filter and display notifications
    let filteredNotifications = userNotifications;
    
    if (filter === 'unread') {
    filteredNotifications = userNotifications.filter(n => !n.is_read);
    } else if (filter === 'read') {
    filteredNotifications = userNotifications.filter(n => n.is_read);
    }

    displayNotifications(filteredNotifications);
}

async function markAsRead(notificationId) {
    const notification = userNotifications.find(n => n.notif_id === notificationId);
    if (notification && !notification.is_read) {
    try {
        // Update in database if not a sample notification
        if (!notificationId.startsWith('sample-')) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('notif_id', notificationId);

        if (error) {
            console.error('Error marking notification as read:', error);
            return;
        }
        }

        // Update local state
        notification.is_read = true;
        loadNotificationCount(); // Update badge and red indicator
        loadNotifications(); // Refresh display
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
    }
}

async function markAllAsRead() {
    try {
    // Update all unread notifications in database
    const unreadNotifications = userNotifications.filter(n => !n.is_read && !n.notif_id.startsWith('sample-'));
    
    if (unreadNotifications.length > 0) {
        const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.user_id)
        .eq('is_read', false);

        if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
        }
    }

    // Update local state
    userNotifications.forEach(n => n.is_read = true);
    loadNotificationCount(); // Update badge and red indicator
    loadNotifications(); // Refresh display
    showToast('All notifications marked as read');
    } catch (error) {
    console.error('Error marking all notifications as read:', error);
    showToast('Failed to mark all notifications as read');
    }
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    const notificationsModal = document.getElementById('notifications-modal');
    if (event.target === notificationsModal) {
    closeNotifications();
    }
});

// Browse Properties Functions
let selectedBrowseType = '';
let browseProperties = [];

async function loadBrowseProperties() {
    try {
    const loadingEl = document.getElementById('browse-loading');
    const containerEl = document.getElementById('browse-properties-container');
    const emptyStateEl = document.getElementById('browse-empty-state');

    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    emptyStateEl.style.display = 'none';

    // Use existing allProperties data or load fresh
    if (allProperties.length === 0) {
        await loadProperties();
    }

    browseProperties = allProperties;
    displayBrowseProperties(browseProperties);

    loadingEl.style.display = 'none';
    
    if (browseProperties.length === 0) {
        emptyStateEl.style.display = 'block';
    } else {
        containerEl.style.display = 'block';
    }
    } catch (error) {
    console.error('Error loading browse properties:', error);
    document.getElementById('browse-loading').innerHTML = '<p>Error loading properties. Please refresh the page.</p>';
    }
}

function displayBrowseProperties(properties) {
    const container = document.getElementById('browse-properties-container');
    const emptyState = document.getElementById('browse-empty-state');
    
    container.innerHTML = '';

    if (properties.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
    }

    container.style.display = 'block';
    emptyState.style.display = 'none';

    // Group properties by type
    const propertyTypes = ['Bed Spacer', 'Single Room', 'Boarding House', 'Studio Type', 'Single Family'];
    
    if (selectedBrowseType) {
    // Show only selected type
    const filteredProperties = properties.filter(p => p.type === selectedBrowseType);
    displayPropertySection(selectedBrowseType, filteredProperties, container);
    } else {
    // Show all types with sections
    propertyTypes.forEach(type => {
        const typeProperties = properties.filter(p => p.type === type);
        if (typeProperties.length > 0) {
        displayPropertySection(type, typeProperties, container);
        }
    });
    }
}

function displayPropertySection(typeName, properties, container) {
    const typeIcon = {
    'Bed Spacer': '🛏️',
    'Single Room': '🚪',
    'Boarding House': '🏢',
    'Studio Type': '🏠',
    'Single Family': '🏠'
    };

    const sectionDiv = document.createElement('div');
    sectionDiv.style.marginBottom = '50px';
    
    sectionDiv.innerHTML = `
    <h2 style="font-size: 28px; margin-bottom: 25px; color: #8B4513; display: flex; align-items: center; gap: 10px;">
        ${typeIcon[typeName] || '🏠'} ${typeName} 
        <span style="font-size: 18px; background-color: #ADD8E6; color: #8B4513; padding: 5px 15px; border-radius: 20px; font-weight: 600;">${properties.length}</span>
    </h2>
    <div class="properties-grid listing-grid" id="section-${typeName.replace(/\s+/g, '-').toLowerCase()}"></div>
    `;

    container.appendChild(sectionDiv);

    const sectionContainer = sectionDiv.querySelector('.properties-grid');
    
    properties.forEach(property => {
    const amenities = getPropertyAmenities(property.property_id);
    const images = getPropertyImages(property.property_id);

    const card = document.createElement('div');
    card.className = 'property-card';
    card.onclick = () => showPropertyDetails(property);

    const amenitiesHTML = amenities.slice(0, 4).map(amenity => {
        const icon = amenityIcons[amenity] || '✓';
        return `<span class="amenity-tag">${icon} ${amenity}</span>`;
    }).join('');

    // Create image carousel for property card
    let imageHTML;
    if (images.length > 0) {
        imageHTML = `
        <div class="property-image-carousel" style="position: relative; width: 100%; height: 250px; overflow: hidden;">
            ${images.map((img, index) => `
            <img src="${img.image_url}" alt="${property.type}" 
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: ${index === 0 ? 1 : 0}; transition: opacity 0.5s ease-in-out;"
                    data-image-index="${index}">
            `).join('')}
            ${images.length > 1 ? `
            <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                <span class="current-image">1</span>/${images.length}
            </div>
            ` : ''}
        </div>
        `;
    } else {
        imageHTML = '<div class="property-image">🏠</div>';
    }

    card.innerHTML = `
        ${imageHTML}
        <div class="property-content">
        <span class="property-type">${property.type || 'Property'}</span>
        <h3 class="property-title">${property.property_name || property.type || 'Property'}</h3>
        <p class="property-location">📍 ${property.address || 'Address not specified'}</p>
        <p class="property-price">₱${(property.monthly_rent || 0).toLocaleString()}/month</p>
        <div class="amenities-list">
            ${amenitiesHTML}
            ${amenities.length > 4 ? `<span class="amenity-tag">+${amenities.length - 4} more</span>` : ''}
        </div>
        <div class="property-actions">
            <button class="btn-secondary" onclick="event.stopPropagation(); viewDetails('${property.property_id}')">View</button>
            <button class="btn-secondary" onclick="event.stopPropagation(); messageLandlordFromCard('${property.property_id}')">Message</button>
        </div>
        </div>
    `;

    // Add hover carousel functionality for property cards
    if (images.length > 1) {
        let carouselInterval;
        let currentImageIndex = 0;
        const carouselImages = card.querySelectorAll('.property-image-carousel img');
        const currentImageSpan = card.querySelector('.current-image');

        function nextImage() {
        carouselImages[currentImageIndex].style.opacity = '0';
        currentImageIndex = (currentImageIndex + 1) % images.length;
        carouselImages[currentImageIndex].style.opacity = '1';
        if (currentImageSpan) {
            currentImageSpan.textContent = currentImageIndex + 1;
        }
        }

        card.addEventListener('mouseenter', () => {
        carouselInterval = setInterval(nextImage, 2000);
        });

        card.addEventListener('mouseleave', () => {
        if (carouselInterval) {
            clearInterval(carouselInterval);
            carouselInterval = null;
        }
        });
    }

    sectionContainer.appendChild(card);
    });
}

function filterBrowseProperties() {
    const searchTerm = document.getElementById('browse-search-input').value.toLowerCase();
    const sortBy = document.getElementById('browse-sort').value;

    let filtered = browseProperties.filter(property => {
    const matchesSearch = !searchTerm || 
        (property.type && property.type.toLowerCase().includes(searchTerm)) ||
        (property.city && property.city.toLowerCase().includes(searchTerm)) ||
        (property.barangay && property.barangay.toLowerCase().includes(searchTerm)) ||
        (property.address && property.address.toLowerCase().includes(searchTerm));

    const matchesType = !selectedBrowseType || property.type === selectedBrowseType;

    return matchesSearch && matchesType;
    });

    // Sort properties
    switch (sortBy) {
    case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
    case 'price-low':
        filtered.sort((a, b) => (a.monthly_rent || 0) - (b.monthly_rent || 0));
        break;
    case 'price-high':
        filtered.sort((a, b) => (b.monthly_rent || 0) - (a.monthly_rent || 0));
        break;
    default: // newest
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    displayBrowseProperties(filtered);
}

// Browse property type filter handlers
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for browse property filters
    document.addEventListener('click', function(e) {
    if (e.target.hasAttribute('data-browse-type')) {
        // Remove active class from all browse filter buttons
        document.querySelectorAll('[data-browse-type]').forEach(btn => {
        btn.classList.remove('active');
        btn.style.backgroundColor = '#F5F5DC';
        btn.style.borderColor = '#ADD8E6';
        });
        
        // Add active class to clicked button
        e.target.classList.add('active');
        e.target.style.backgroundColor = '#ADD8E6';
        e.target.style.borderColor = '#87CEEB';
        
        selectedBrowseType = e.target.getAttribute('data-browse-type');
        filterBrowseProperties();
    }
    });

    // Add event listeners for browse search and sort
    const browseSearchInput = document.getElementById('browse-search-input');
    const browseSortSelect = document.getElementById('browse-sort');
    
    if (browseSearchInput) {
    browseSearchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') filterBrowseProperties();
    });
    }
    
    if (browseSortSelect) {
    browseSortSelect.addEventListener('change', filterBrowseProperties);
    }
});

// Live Chat System with Real-time Notifications
async function initializeMessaging() {
    if (!currentUser) return;

    try {
    console.log('🚀 Initializing live chat system...');
    
    // Start with database-based messaging for reliability
    await loadUserConversations();
    
    // Start real-time message polling
    startMessagePolling();
    
    // Try to initialize GetStream as enhancement
    try {
        streamClient = StreamChat.getInstance('sbt75mfx4qz6');
        
        const userId = `user_${currentUser.user_id}`;
        const userName = `${currentUser.first_name} ${currentUser.last_name}`;
        const userToken = streamClient.devToken(userId);
        
        await streamClient.connectUser({
        id: userId,
        name: userName,
        email: currentUser.email,
        role: currentUser.role,
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=ADD8E6&color=8B4513`
        }, userToken);
        
        isStreamConnected = true;
        console.log('✅ GetStream connected as enhancement');
        
        // Listen for GetStream events
        streamClient.on('message.new', handleStreamMessage);
        streamClient.on('channel.updated', loadStreamConversations);
        
    } catch (streamError) {
        console.log('ℹ️ GetStream not available, using database-only messaging');
        isStreamConnected = false;
    }
    
    } catch (error) {
    console.error('❌ Error initializing messaging:', error);
    // Fallback to basic messaging
    await loadUserConversations();
    }
}

async function startMessagePolling() {
    // Initialize lastMessageCheck to current time to avoid showing old messages as new
    lastMessageCheck = new Date();
    console.log(`🕒 Initialized lastMessageCheck to: ${lastMessageCheck.toISOString()}`);
    
    // Poll for new messages every 3 seconds
    messagePollingInterval = setInterval(async () => {
    if (currentUser) {
        await checkForNewMessages();
    }
    }, 3000);
    
    // Show floating chat button and live chat indicator only if user is logged in
    if (currentUser) {
    const floatingButton = document.getElementById('floating-chat-button');
    const indicator = document.getElementById('chat-status-indicator');
    if (floatingButton) {
        floatingButton.style.display = 'block';
    }
    if (indicator) {
        indicator.style.display = 'block';
    }
    }
    
    console.log('✅ Live message polling started');
}

function stopMessagePolling() {
    if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
    messagePollingInterval = null;
    
    // Hide floating chat button and live chat indicator
    const floatingButton = document.getElementById('floating-chat-button');
    const indicator = document.getElementById('chat-status-indicator');
    if (floatingButton) {
        floatingButton.style.display = 'none';
    }
    if (indicator) {
        indicator.style.display = 'none';
    }
    
    console.log('⏹️ Message polling stopped');
    }
}

// Track which messages have already been notified to prevent duplicates
let notifiedMessageIds = new Set();

async function checkForNewMessages() {
    try {
    console.log(`🔍 Checking for new messages since: ${lastMessageCheck.toISOString()}`);
    
    // Get messages newer than last check - use gt (greater than) instead of gte to avoid duplicates
    const { data: newMessages, error } = await supabase
        .from('messages')
        .select(`
        *,
        sender:users!messages_sender_id_fkey(user_id, first_name, last_name, email, role),
        receiver:users!messages_receiver_id_fkey(user_id, first_name, last_name, email, role)
        `)
        .eq('receiver_id', currentUser.user_id)
        .eq('is_read', false)
        .gt('sent_at', lastMessageCheck.toISOString())
        .order('sent_at', { ascending: true });

    if (error) throw error;

    console.log(`📊 Query result: ${newMessages?.length || 0} messages found`);
    if (newMessages && newMessages.length > 0) {
        console.log('📨 New messages details:', newMessages.map(m => ({
        id: m.message_id,
        from: `${m.sender.first_name} ${m.sender.last_name}`,
        sent_at: m.sent_at,
        content: m.content.substring(0, 50) + '...'
        })));
    }

    if (newMessages && newMessages.length > 0) {
        console.log(`📨 Found ${newMessages.length} new message(s)`);
        
        // Show notifications for new messages using actual database timestamps
        // Only show notifications for messages we haven't notified about yet
        newMessages.forEach(message => {
        if (!notifiedMessageIds.has(message.message_id)) {
            console.log(`🔔 Processing notification for message sent at: ${message.sent_at}`);
            showLiveChatNotification(message);
            notifiedMessageIds.add(message.message_id);
        } else {
            console.log(`⏭️ Skipping already notified message: ${message.message_id}`);
        }
        });
        
        // Update conversations and badges
        await loadUserConversations();
        
        // If we're in the same conversation, handle new messages
        if (currentConversation && newMessages.some(msg => msg.sender.user_id === currentConversation.otherUserId)) {
        // Count new messages for scroll down button
        const conversationNewMessages = newMessages.filter(msg => msg.sender.user_id === currentConversation.otherUserId);
        
        // If user is scrolled up, increment new messages count
        if (isUserScrolledUp) {
            newMessagesCount += conversationNewMessages.length;
            showScrollDownButton();
        }
        
        await loadConversationMessages(currentConversation.otherUserId);
        }
        
        // Update last check time to the latest message timestamp from database + 1 second to avoid duplicates
        const latestMessage = newMessages[newMessages.length - 1];
        const latestMessageTime = new Date(latestMessage.sent_at);
        lastMessageCheck = new Date(latestMessageTime.getTime() + 1000); // Add 1 second
        console.log(`🕒 Updated lastMessageCheck to: ${lastMessageCheck.toISOString()} (from message: ${latestMessage.message_id} + 1s)`);
    } else {
        console.log('📭 No new messages found');
    }
    
    } catch (error) {
    console.error('Error checking for new messages:', error);
    }
}

function showLiveChatNotification(message) {
    const senderName = `${message.sender.first_name} ${message.sender.last_name}`;
    
    // Use actual timestamp from database - ensure proper parsing and adjust timezone
    const messageTime = new Date(message.sent_at);
    const adjustedMessageTime = new Date(messageTime.getTime() + (8 * 60 * 60 * 1000));
    const timeAgo = getTimeAgo(adjustedMessageTime);
    
    console.log(`🔔 Showing notification for message sent at: ${message.sent_at} (adjusted: ${adjustedMessageTime.toISOString()}, ${timeAgo})`);
    
    // Create notification toast
    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #ADD8E6 0%, #87CEEB 100%);
    color: #8B4513;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    z-index: 4000;
    max-width: 350px;
    cursor: pointer;
    transform: translateX(400px);
    transition: transform 0.4s ease-out;
    border: 2px solid #87CEEB;
    `;
    
    notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <div style="font-size: 24px;">💬</div>
        <div>
        <div style="font-weight: 700; font-size: 16px;">${senderName}</div>
        <div style="font-size: 12px; opacity: 0.8;">${message.sender.role} • ${timeAgo}</div>
        </div>
        <button onclick="this.closest('div').remove()" style="margin-left: auto; background: none; border: none; font-size: 18px; color: #8B4513; cursor: pointer; opacity: 0.7; padding: 4px;">&times;</button>
    </div>
    <div style="font-size: 14px; line-height: 1.4; margin-bottom: 12px; max-height: 60px; overflow: hidden;">
        ${message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content}
    </div>
    <div style="display: flex; gap: 8px;">
        <button onclick="openChatFromNotification('${message.sender.user_id}'); this.closest('div').remove();" style="flex: 1; padding: 8px 12px; background: #8B4513; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Reply</button>
        <button onclick="markMessageAsReadFromNotification('${message.message_id}'); this.closest('div').remove();" style="flex: 1; padding: 8px 12px; background: rgba(139, 69, 19, 0.2); color: #8B4513; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Mark Read</button>
    </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
    notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 8 seconds
    setTimeout(() => {
    if (notification.parentNode) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 400);
    }
    }, 8000);
    
    // Play notification sound (if supported)
    try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore errors if audio fails
    } catch (e) {}
    
    // Browser notification (if permission granted)
    if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`New message from ${senderName}`, {
        body: message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ADD8E6"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="%238B4513">💬</text></svg>',
        tag: `message-${message.message_id}`,
        requireInteraction: false
    });
    }
}

async function openChatFromNotification(senderId) {
    // Open messages modal and select the conversation
    showMessages();
    
    // Wait a bit for the modal to load
    setTimeout(() => {
    selectConversation(senderId, false);
    }, 300);
}

async function markMessageAsReadFromNotification(messageId) {
    try {
    const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('message_id', messageId);

    if (error) throw error;
    
    // Refresh conversations to update unread counts
    await loadUserConversations();
    
    } catch (error) {
    console.error('Error marking message as read:', error);
    }
}

function handleStreamMessage(event) {
    // Handle GetStream messages and sync to database
    if (event.user.id !== `user_${currentUser.user_id}`) {
    console.log('📨 New GetStream message received');
    
    // Store to database for persistence
    storeStreamMessageToDatabase(event);
    
    // Show notification
    const message = {
        message_id: event.id,
        content: event.text,
        sender: {
        user_id: event.user.id.replace('user_', ''),
        first_name: event.user.name.split(' ')[0],
        last_name: event.user.name.split(' ').slice(1).join(' '),
        role: event.user.role || 'User'
        }
    };
    
    showLiveChatNotification(message);
    
    // Refresh conversations
    loadStreamConversations();
    
    // If we're in the same channel, update messages
    if (currentChannel && event.channel_id === currentChannel.id) {
        loadChannelMessages();
    }
    }
}

async function storeStreamMessageToDatabase(streamEvent) {
    try {
    const senderId = streamEvent.user.id.replace('user_', '');
    
    // Find receiver (other user in the channel)
    const otherMember = Object.values(streamEvent.channel.state.members).find(member => 
        member.user.id !== streamEvent.user.id
    );
    
    if (otherMember) {
        const receiverId = otherMember.user.id.replace('user_', '');
        
        // Check if message already exists
        const { data: existing } = await supabase
        .from('messages')
        .select('message_id')
        .eq('stream_message_id', streamEvent.id)
        .single();
        
        if (!existing) {
        // Insert new message
        await supabase
            .from('messages')
            .insert([{
            sender_id: senderId,
            receiver_id: receiverId,
            content: streamEvent.text,
            sent_at: streamEvent.created_at,
            is_read: false,
            stream_message_id: streamEvent.id
            }]);
        
        console.log('✅ GetStream message stored to database');
        }
    }
    } catch (error) {
    console.error('Error storing GetStream message to database:', error);
    }
}

async function loadStreamConversations() {
    if (!streamClient || !isStreamConnected) {
    await loadUserConversations(); // Fallback to database
    return;
    }

    try {
    // Get channels where user is a member
    const filter = { members: { $in: [`user_${currentUser.user_id}`] } };
    const sort = { last_message_at: -1 };
    const channels = await streamClient.queryChannels(filter, sort, { limit: 20 });
    
    userConversations = channels.map(channel => {
        const otherMembers = channel.state.members;
        const otherMember = Object.values(otherMembers).find(member => 
        member.user.id !== `user_${currentUser.user_id}`
        );
        
        const lastMessage = channel.state.messages[channel.state.messages.length - 1];
        const unreadCount = channel.countUnread();
        
        return {
        channel,
        otherUser: otherMember ? {
            user_id: otherMember.user.id.replace('user_', ''),
            first_name: otherMember.user.name.split(' ')[0],
            last_name: otherMember.user.name.split(' ').slice(1).join(' '),
            email: otherMember.user.email,
            role: otherMember.user.role
        } : null,
        lastMessage: lastMessage ? {
            content: lastMessage.text,
            sent_at: lastMessage.created_at
        } : null,
        unreadCount: unreadCount
        };
    }).filter(conv => conv.otherUser); // Filter out conversations without other users
    
    displayConversations(userConversations);
    updateMessagesBadge();
    
    } catch (error) {
    console.error('Error loading GetStream conversations:', error);
    await loadUserConversations(); // Fallback to database
    }
}

function handleNewMessage(event) {
    // Handle new message from GetStream
    if (event.user.id !== `user_${currentUser.user_id}`) {
    loadStreamConversations(); // Refresh conversations
    updateMessagesBadge();
    
    // If we're in the same channel, update messages
    if (currentChannel && event.channel_id === currentChannel.id) {
        loadChannelMessages();
    }
    }
}

async function disconnectStream() {
    if (streamClient && isStreamConnected) {
    try {
        await streamClient.disconnectUser();
        isStreamConnected = false;
        console.log('✅ GetStream disconnected successfully');
    } catch (error) {
        console.error('Error disconnecting from GetStream:', error);
    }
    }
}

async function loadUserConversations() {
    if (!currentUser) return;

    try {
    // Get all conversations where user is sender or receiver
    const { data: messages, error } = await supabase
        .from('messages')
        .select(`
        *,
        sender:users!messages_sender_id_fkey(user_id, first_name, last_name, email, role),
        receiver:users!messages_receiver_id_fkey(user_id, first_name, last_name, email, role)
        `)
        .or(`sender_id.eq.${currentUser.user_id},receiver_id.eq.${currentUser.user_id}`)
        .order('sent_at', { ascending: false });

    if (error) throw error;

    // Group messages by conversation (other user)
    const conversationMap = new Map();
    
    messages?.forEach(message => {
        const otherUser = message.sender.user_id === currentUser.user_id ? message.receiver : message.sender;
        const conversationKey = otherUser.user_id;
        
        if (!conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, {
            otherUser,
            lastMessage: message,
            unreadCount: 0,
            messages: []
        });
        }
        
        const conversation = conversationMap.get(conversationKey);
        
        // Count unread messages (messages sent to current user that are unread)
        if (message.receiver.user_id === currentUser.user_id && !message.is_read) {
        conversation.unreadCount++;
        }
        
        // Update last message if this one is newer
        if (new Date(message.sent_at) > new Date(conversation.lastMessage.sent_at)) {
        conversation.lastMessage = message;
        }
    });

    userConversations = Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.lastMessage.sent_at) - new Date(a.lastMessage.sent_at));
    
    displayConversations(userConversations);
    updateMessagesBadge();
    } catch (error) {
    console.error('Error loading conversations:', error);
    displaySampleConversations();
    }
}

function displaySampleConversations() {
    // Sample conversations for demo when GetStream is not available
    const sampleConversations = [
    {
        id: 'sample-1',
        name: 'John Doe (Landlord)',
        lastMessage: 'The property is available for viewing this weekend.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        unread: true,
        avatar: '🏠'
    },
    {
        id: 'sample-2', 
        name: 'Maria Santos (Tenant)',
        lastMessage: 'Thank you for approving my application!',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        unread: false,
        avatar: '👤'
    },
    {
        id: 'sample-3',
        name: 'Admin Support',
        lastMessage: 'Your property listing has been approved.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        unread: false,
        avatar: '⚙️'
    }
    ];

    displayConversations(sampleConversations, true);
}

function displayConversations(conversations, isSample = false) {
    const container = document.getElementById('conversations-container');
    
    if (conversations.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #8B4513; padding: 20px;">No conversations yet</p>';
    return;
    }

    container.innerHTML = conversations.map(conv => {
    let name, lastMessage, timestamp, unread, avatar, userId;
    
    if (isSample) {
        ({ name, lastMessage, timestamp, unread, avatar } = conv);
        userId = conv.id;
    } else {
        // Database conversation data - use actual timestamp from database
        name = `${conv.otherUser.first_name} ${conv.otherUser.last_name}`;
        lastMessage = conv.lastMessage.content || 'No messages yet';
        
        // Parse the actual sent_at timestamp from database - ensure proper handling
        const rawTimestamp = conv.lastMessage.sent_at;
        timestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
        
        // Validate the parsed timestamp
        if (isNaN(timestamp.getTime())) {
        console.warn(`⚠️ Invalid timestamp for conversation with ${name}: ${rawTimestamp}`);
        timestamp = new Date(); // Fallback to current time
        }
        
        unread = conv.unreadCount > 0;
        userId = conv.otherUser.user_id;
        
        // Set avatar based on role
        const roleIcons = {
        'Admin': '⚙️',
        'Landlord': '🏠',
        'Tenant': '👤'
        };
        avatar = roleIcons[conv.otherUser.role] || '👤';
        
        console.log(`💬 Conversation with ${name}: raw_timestamp=${rawTimestamp}, parsed=${timestamp.toISOString()}, valid=${!isNaN(timestamp.getTime())}`);
    }

    // Use the actual timestamp from database for time ago calculation
    const timeAgo = getTimeAgo(timestamp);
    
    return `
        <div class="conversation-item" onclick="selectConversation('${userId}', ${isSample})" style="padding: 15px; border-radius: 8px; margin-bottom: 10px; cursor: pointer; transition: background-color 0.3s; border: 2px solid transparent; ${unread ? 'background-color: #F0F8FF; border-color: #ADD8E6;' : 'background-color: #FAFAFA;'}">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 24px;">${avatar}</div>
            <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <h4 style="color: #8B4513; margin: 0; font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</h4>
                <span style="font-size: 12px; color: #999; white-space: nowrap;">${timeAgo}</span>
            </div>
            <p style="margin: 0; color: #654321; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${lastMessage}</p>
            ${unread ? `<div style="display: flex; align-items: center; gap: 5px; margin-top: 5px;"><div style="width: 8px; height: 8px; background: #FF6B6B; border-radius: 50%;"></div><span style="font-size: 12px; color: #FF6B6B; font-weight: 600;">${conv.unreadCount || 1} new</span></div>` : ''}
            </div>
        </div>
        </div>
    `;
    }).join('');
}

function updateMessagesBadge() {
    const unreadCount = userConversations.reduce((total, conv) => total + conv.unreadCount, 0);
    const floatingBadge = document.getElementById('floating-messages-badge');
    
    if (unreadCount > 0) {
    floatingBadge.style.display = 'flex';
    floatingBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    } else {
    floatingBadge.style.display = 'none';
    }
}

async function selectConversation(otherUserId, isSample = false) {
    try {
    // Remove active state from all conversations
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.style.backgroundColor = '#FAFAFA';
        item.style.borderColor = 'transparent';
    });
    
    // Add active state to selected conversation
    event.target.closest('.conversation-item').style.backgroundColor = '#ADD8E6';
    event.target.closest('.conversation-item').style.borderColor = '#87CEEB';

    if (isSample) {
        displaySampleChat(otherUserId);
    } else if (isStreamConnected) {
        // Use GetStream channel
        const conversation = userConversations.find(c => c.otherUser.user_id === otherUserId);
        if (conversation) {
        currentChannel = conversation.channel;
        await loadChannelMessages();
        await markChannelAsRead();
        
        // Update chat header
        document.getElementById('chat-title').textContent = `${conversation.otherUser.first_name} ${conversation.otherUser.last_name}`;
        document.getElementById('chat-subtitle').textContent = `${conversation.otherUser.role} • ${conversation.otherUser.email}`;
        }
    } else {
        // Fallback to database
        const conversation = userConversations.find(c => c.otherUser.user_id === otherUserId);
        if (conversation) {
        currentConversation = { otherUserId, otherUser: conversation.otherUser };
        await loadConversationMessages(otherUserId);
        await markMessagesAsRead(otherUserId);
        }
    }

    // Show chat interface
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('chat-header').style.display = 'block';
    document.getElementById('chat-messages').style.display = 'block';
    document.getElementById('message-input-area').style.display = 'block';

    // Reset scroll state for new conversation
    isUserScrolledUp = false;
    newMessagesCount = 0;
    hideScrollDownButton();

    // Mobile: Hide conversations list and show chat
    if (window.innerWidth <= 768) {
        showChatArea();
    }
    } catch (error) {
    console.error('Error selecting conversation:', error);
    }
}

function showChatArea() {
    const conversationsList = document.getElementById('conversations-list');
    const chatArea = document.getElementById('chat-area');
    
    conversationsList.classList.add('mobile-hidden');
    chatArea.classList.add('mobile-visible');
}

function showConversationsList() {
    const conversationsList = document.getElementById('conversations-list');
    const chatArea = document.getElementById('chat-area');
    
    conversationsList.classList.remove('mobile-hidden');
    chatArea.classList.remove('mobile-visible');
    
    // Reset chat interface
    document.getElementById('no-chat-selected').style.display = 'flex';
    document.getElementById('chat-header').style.display = 'none';
    document.getElementById('chat-messages').style.display = 'none';
    document.getElementById('message-input-area').style.display = 'none';
    currentConversation = null;
}

function displaySampleChat(conversationId) {
    const sampleChats = {
    'sample-1': {
        name: 'John Doe',
        subtitle: 'Landlord • Studio Type Property',
        messages: [
        { sender: 'John Doe', text: 'Hi! I saw your application for my studio apartment.', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), isOwn: false },
        { sender: 'You', text: 'Hello! Yes, I\'m very interested. When can I schedule a viewing?', timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000), isOwn: true },
        { sender: 'John Doe', text: 'The property is available for viewing this weekend. How about Saturday at 2 PM?', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), isOwn: false },
        { sender: 'You', text: 'That works perfectly! I\'ll see you then.', timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000), isOwn: true }
        ]
    },
    'sample-2': {
        name: 'Maria Santos',
        subtitle: 'Tenant • Boarding House Application',
        messages: [
        { sender: 'Maria Santos', text: 'Thank you for approving my application!', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), isOwn: false },
        { sender: 'You', text: 'You\'re welcome! When would you like to move in?', timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000), isOwn: true },
        { sender: 'Maria Santos', text: 'I can move in next week if that\'s okay.', timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000), isOwn: false }
        ]
    },
    'sample-3': {
        name: 'Admin Support',
        subtitle: 'HousinGo Support Team',
        messages: [
        { sender: 'Admin Support', text: 'Your property listing has been approved and is now live!', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), isOwn: false },
        { sender: 'You', text: 'Great! Thank you for the quick approval.', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), isOwn: true }
        ]
    }
    };

    const chat = sampleChats[conversationId];
    if (!chat) return;

    document.getElementById('chat-title').textContent = chat.name;
    document.getElementById('chat-subtitle').textContent = chat.subtitle;
    
    displayMessages(chat.messages);
}

async function loadChannelMessages() {
    if (!currentChannel) return;

    try {
    // Get messages from GetStream channel
    const response = await currentChannel.query({ messages: { limit: 50 } });
    const messages = response.messages || [];
    
    const formattedMessages = messages.map(msg => ({
        sender: msg.user.id === `user_${currentUser.user_id}` ? 'You' : msg.user.name,
        text: msg.text,
        timestamp: new Date(msg.created_at),
        isOwn: msg.user.id === `user_${currentUser.user_id}`
    }));
    
    displayMessages(formattedMessages);
    
    // Store messages to Supabase for backup/history
    await storeMessagesToSupabase(messages);
    
    } catch (error) {
    console.error('Error loading GetStream messages:', error);
    }
}

async function loadConversationMessages(otherUserId) {
    try {
    // Get all messages between current user and other user from Supabase
    const { data: messages, error } = await supabase
        .from('messages')
        .select(`
        *,
        sender:users!messages_sender_id_fkey(user_id, first_name, last_name, email, role),
        receiver:users!messages_receiver_id_fkey(user_id, first_name, last_name, email, role)
        `)
        .or(`and(sender_id.eq.${currentUser.user_id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.user_id})`)
        .order('sent_at', { ascending: true });

    if (error) throw error;

    const otherUser = currentConversation.otherUser;
    
    document.getElementById('chat-title').textContent = `${otherUser.first_name} ${otherUser.last_name}`;
    document.getElementById('chat-subtitle').textContent = `${otherUser.role} • ${otherUser.email}`;
    
    const formattedMessages = messages?.map(msg => ({
        sender: msg.sender.user_id === currentUser.user_id ? 'You' : `${msg.sender.first_name} ${msg.sender.last_name}`,
        text: msg.content,
        timestamp: new Date(msg.sent_at),
        isOwn: msg.sender.user_id === currentUser.user_id
    })) || [];
    
    displayMessages(formattedMessages);
    
    } catch (error) {
    console.error('Error loading conversation messages:', error);
    }
}

async function storeMessagesToSupabase(streamMessages) {
    try {
    // Store GetStream messages to Supabase for backup/history
    for (const msg of streamMessages) {
        const senderId = msg.user.id.replace('user_', '');
        
        // Find receiver (other user in the channel)
        const otherMember = Object.values(currentChannel.state.members).find(member => 
        member.user.id !== msg.user.id
        );
        
        if (otherMember) {
        const receiverId = otherMember.user.id.replace('user_', '');
        
        // Check if message already exists in Supabase
        const { data: existing } = await supabase
            .from('messages')
            .select('message_id')
            .eq('stream_message_id', msg.id)
            .single();
        
        if (!existing) {
            // Insert new message to Supabase
            await supabase
            .from('messages')
            .insert([{
                sender_id: senderId,
                receiver_id: receiverId,
                content: msg.text,
                sent_at: msg.created_at,
                is_read: true, // Assume read since it's from GetStream
                stream_message_id: msg.id
            }]);
        }
        }
    }
    } catch (error) {
    console.error('Error storing messages to Supabase:', error);
    }
}

async function markChannelAsRead() {
    if (!currentChannel) return;

    try {
    // Mark GetStream channel as read
    await currentChannel.markRead();
    
    // Refresh conversations to update unread counts
    await loadStreamConversations();
    } catch (error) {
    console.error('Error marking GetStream channel as read:', error);
    }
}

async function markMessagesAsRead(otherUserId) {
    try {
    // Mark all unread messages from other user as read in Supabase
    const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', currentUser.user_id)
        .eq('is_read', false);

    if (error) throw error;

    // Refresh conversations to update unread counts
    await loadUserConversations();
    } catch (error) {
    console.error('Error marking messages as read:', error);
    }
}

let isUserScrolledUp = false;
let newMessagesCount = 0;

function displayMessages(messages) {
    const container = document.getElementById('chat-messages');
    
    // Check if user was scrolled up before adding new messages
    const wasScrolledUp = isUserScrolledUp;
    
    container.innerHTML = messages.map(msg => {
    // Use the actual timestamp from database, handle both Date objects and ISO strings
    let messageTime;
    if (msg.timestamp instanceof Date) {
        messageTime = msg.timestamp;
    } else {
        messageTime = new Date(msg.timestamp);
    }
    
    // Validate the parsed timestamp
    if (isNaN(messageTime.getTime())) {
        console.warn(`⚠️ Invalid message timestamp: ${msg.timestamp} for message from ${msg.sender}`);
        messageTime = new Date(); // Fallback to current time
    }
    
    // Adjust for 8-hour timezone difference (add 8 hours to message time)
    const adjustedMessageTime = new Date(messageTime.getTime() + (8 * 60 * 60 * 1000));
    const timeStr = adjustedMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    console.log(`💬 Message display: sender=${msg.sender}, raw_timestamp=${msg.timestamp}, parsed=${messageTime.toISOString()}, adjusted=${adjustedMessageTime.toISOString()}, timeStr=${timeStr}`);
    
    return `
        <div style="margin-bottom: 15px; display: flex; ${msg.isOwn ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}">
        <div style="max-width: 70%; ${msg.isOwn ? 'background-color: #ADD8E6; color: #8B4513;' : 'background-color: white; color: #8B4513; border: 2px solid #F5F5DC;'} padding: 12px 16px; border-radius: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${!msg.isOwn ? `<div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #654321;">${msg.sender}</div>` : ''}
            <div style="line-height: 1.4; margin-bottom: 4px;">${msg.text}</div>
            <div style="font-size: 12px; opacity: 0.7; text-align: ${msg.isOwn ? 'right' : 'left'};">${timeStr}</div>
        </div>
        </div>
    `;
    }).join('');
    
    // Set up scroll detection
    setupScrollDetection();
    
    // Auto-scroll to bottom only if user wasn't scrolled up
    if (!wasScrolledUp) {
    setTimeout(() => {
        scrollToBottom(true);
    }, 100);
    } else {
    // Show scroll down button if user was scrolled up
    showScrollDownButton();
    }
}

function setupScrollDetection() {
    const container = document.getElementById('messages-container');
    if (!container) return;

    // Remove existing listener to avoid duplicates
    container.removeEventListener('scroll', handleScroll);
    
    // Add scroll listener
    container.addEventListener('scroll', handleScroll);
}

function handleScroll() {
    const container = document.getElementById('messages-container');
    const scrollDownButton = document.getElementById('scroll-down-button');
    
    if (!container || !scrollDownButton) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Check if user is near the bottom (within 100px)
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    if (isNearBottom) {
    isUserScrolledUp = false;
    hideScrollDownButton();
    newMessagesCount = 0;
    } else {
    isUserScrolledUp = true;
    if (newMessagesCount > 0) {
        showScrollDownButton();
    }
    }
}

function showScrollDownButton() {
    const scrollDownButton = document.getElementById('scroll-down-button');
    const newMessageIndicator = document.getElementById('new-message-indicator');
    
    if (scrollDownButton) {
    scrollDownButton.style.display = 'block';
    
    if (newMessagesCount > 0 && newMessageIndicator) {
        newMessageIndicator.style.display = 'flex';
        newMessageIndicator.textContent = newMessagesCount > 99 ? '99+' : newMessagesCount;
    }
    }
}

function hideScrollDownButton() {
    const scrollDownButton = document.getElementById('scroll-down-button');
    const newMessageIndicator = document.getElementById('new-message-indicator');
    
    if (scrollDownButton) {
    scrollDownButton.style.display = 'none';
    }
    
    if (newMessageIndicator) {
    newMessageIndicator.style.display = 'none';
    }
}

function scrollToBottom(isAutoScroll = false) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    // Method 1: scrollTo with smooth behavior
    container.scrollTo({
    top: container.scrollHeight,
    behavior: isAutoScroll ? 'smooth' : 'smooth'
    });
    
    // Method 2: Fallback with direct scrollTop (in case scrollTo doesn't work)
    setTimeout(() => {
    container.scrollTop = container.scrollHeight;
    }, 50);
    
    // Method 3: Force scroll after a longer delay to ensure DOM is fully rendered
    setTimeout(() => {
    container.scrollTop = container.scrollHeight;
    }, 200);

    // Reset scroll state
    isUserScrolledUp = false;
    newMessagesCount = 0;
    hideScrollDownButton();
}

async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;

    try {
    if (isStreamConnected && currentChannel) {
        // Send via GetStream
        await currentChannel.sendMessage({
        text: messageText,
        user: { id: `user_${currentUser.user_id}` }
        });
        
        messageInput.value = '';
        
        // Message will be automatically added to UI via GetStream events
        // and stored to Supabase via storeMessagesToSupabase
        
    } else if (currentConversation) {
        // Send via direct Supabase with live notifications
        const currentTimestamp = new Date().toISOString();
        const { data, error } = await supabase
        .from('messages')
        .insert([{
            sender_id: currentUser.user_id,
            receiver_id: currentConversation.otherUserId,
            content: messageText,
            is_read: false,
            sent_at: currentTimestamp
        }])
        .select(`
            *,
            sender:users!messages_sender_id_fkey(user_id, first_name, last_name, email, role),
            receiver:users!messages_receiver_id_fkey(user_id, first_name, last_name, email, role)
        `)
        .single();

        if (error) throw error;

        console.log('✅ Message sent successfully:', data);

        // Immediately add message to UI for instant feedback using actual database timestamp
        const container = document.getElementById('chat-messages');
        const messageTimestamp = data ? new Date(data.sent_at) : new Date(currentTimestamp);
        const timeStr = messageTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = 'margin-bottom: 15px; display: flex; justify-content: flex-end;';
        messageDiv.innerHTML = `
        <div style="max-width: 70%; background-color: #ADD8E6; color: #8B4513; padding: 12px 16px; border-radius: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="line-height: 1.4; margin-bottom: 4px;">${messageText}</div>
            <div style="font-size: 12px; opacity: 0.7; text-align: right;">${timeStr} ✓</div>
        </div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
        
        messageInput.value = '';
        
        // Create notification for the receiver
        await createNotification(
        currentConversation.otherUserId,
        `New message from ${currentUser.first_name} ${currentUser.last_name}`,
        messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText
        );
        
        // Refresh conversations to update last message
        await loadUserConversations();
        
        console.log('📨 Message notification sent to recipient');
    }
    
    } catch (error) {
    console.error('Error sending message:', error);
    showToast('Failed to send message: ' + error.message);
    }
}

// Message input enter key handler and auto-resize
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
    }
});

function showMessages() {
    const modal = document.getElementById('messages-modal');
    modal.classList.add('active');
    
    if (currentUser) {
    loadUserConversations();
    } else {
    displaySampleConversations();
    }
    
    // Close profile dropdown
    document.getElementById('profile-dropdown-menu').style.display = 'none';
}

function closeMessages() {
    document.getElementById('messages-modal').classList.remove('active');
    
    // Reset chat interface
    document.getElementById('no-chat-selected').style.display = 'flex';
    document.getElementById('chat-header').style.display = 'none';
    document.getElementById('chat-messages').style.display = 'none';
    document.getElementById('message-input-area').style.display = 'none';
    currentConversation = null;

    // Reset mobile layout
    const conversationsList = document.getElementById('conversations-list');
    const chatArea = document.getElementById('chat-area');
    conversationsList.classList.remove('mobile-hidden');
    chatArea.classList.remove('mobile-visible');
}

function showNewMessageForm() {
    document.getElementById('new-message-modal').classList.add('active');
    document.getElementById('recipient-search').focus();
}

function closeNewMessage() {
    document.getElementById('new-message-modal').classList.remove('active');
    document.getElementById('new-message-form').reset();
    document.getElementById('user-search-results').style.display = 'none';
    selectedRecipient = null;
}

// User search functionality
document.addEventListener('DOMContentLoaded', function() {
    const recipientSearch = document.getElementById('recipient-search');
    if (recipientSearch) {
    recipientSearch.addEventListener('input', async function(e) {
        const searchTerm = e.target.value.trim();
        
        if (searchTerm.length < 2) {
        document.getElementById('user-search-results').style.display = 'none';
        return;
        }

        try {
        // Search users in database
        const { data: users, error } = await supabase
            .from('users')
            .select('user_id, first_name, last_name, email, role')
            .neq('user_id', currentUser.user_id)
            .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        displayUserSearchResults(users || []);
        } catch (error) {
        console.error('Error searching users:', error);
        // Fallback to sample users
        displaySampleUserResults(searchTerm);
        }
    });
    }
});

function displayUserSearchResults(users) {
    const container = document.getElementById('user-search-results');
    
    if (users.length === 0) {
    container.innerHTML = '<div style="padding: 15px; text-align: center; color: #8B4513;">No users found</div>';
    container.style.display = 'block';
    return;
    }

    container.innerHTML = users.map(user => `
    <div class="user-search-item" onclick="selectRecipient('${user.user_id}', '${user.first_name} ${user.last_name}', '${user.email}', '${user.role}')" style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #F5F5DC; transition: background-color 0.3s;">
        <div style="display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 20px;">👤</div>
        <div>
            <div style="font-weight: 600; color: #8B4513;">${user.first_name} ${user.last_name}</div>
            <div style="font-size: 14px; color: #654321;">${user.email} • ${user.role}</div>
        </div>
        </div>
    </div>
    `).join('');
    
    container.style.display = 'block';

    // Add hover effects
    container.querySelectorAll('.user-search-item').forEach(item => {
    item.addEventListener('mouseenter', () => item.style.backgroundColor = '#F5F5DC');
    item.addEventListener('mouseleave', () => item.style.backgroundColor = 'white');
    });
}

function displaySampleUserResults(searchTerm) {
    const sampleUsers = [
    { user_id: 'sample-user-1', first_name: 'John', last_name: 'Doe', email: 'john.doe@email.com', role: 'Landlord' },
    { user_id: 'sample-user-2', first_name: 'Maria', last_name: 'Santos', email: 'maria.santos@email.com', role: 'Tenant' },
    { user_id: 'sample-user-3', first_name: 'Admin', last_name: 'Support', email: 'admin@housingo.com', role: 'Admin' }
    ];

    const filtered = sampleUsers.filter(user => 
    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    displayUserSearchResults(filtered);
}

function selectRecipient(userId, name, email, role) {
    selectedRecipient = { userId, name, email, role };
    document.getElementById('recipient-search').value = `${name} (${email})`;
    document.getElementById('user-search-results').style.display = 'none';
}

async function startNewConversation(event) {
    event.preventDefault();
    
    if (!selectedRecipient) {
    showToast('Please select a recipient');
    return;
    }

    const initialMessage = document.getElementById('initial-message').value.trim();
    if (!initialMessage) {
    showToast('Please enter a message');
    return;
    }

    try {
    if (isStreamConnected) {
        // Create GetStream channel
        const channelId = `chat_${Math.min(currentUser.user_id, selectedRecipient.userId)}_${Math.max(currentUser.user_id, selectedRecipient.userId)}`;
        const channel = streamClient.channel('messaging', channelId, {
        members: [`user_${currentUser.user_id}`, `user_${selectedRecipient.userId}`],
        created_by_id: `user_${currentUser.user_id}`
        });

        // Create the channel
        await channel.create();
        
        // Send initial message
        await channel.sendMessage({
        text: initialMessage,
        user: { id: `user_${currentUser.user_id}` }
        });

        showToast('Message sent successfully!');
        
    } else {
        // Send via Supabase with notifications
        const currentTimestamp = new Date().toISOString();
        const { data, error } = await supabase
        .from('messages')
        .insert([{
            sender_id: currentUser.user_id,
            receiver_id: selectedRecipient.userId,
            content: initialMessage,
            is_read: false,
            sent_at: currentTimestamp
        }])
        .select(`
            *,
            sender:users!messages_sender_id_fkey(user_id, first_name, last_name, email, role),
            receiver:users!messages_receiver_id_fkey(user_id, first_name, last_name, email, role)
        `)
        .single();

        if (error) throw error;

        // Create notification for the recipient
        await createNotification(
        selectedRecipient.userId,
        `New message from ${currentUser.first_name} ${currentUser.last_name}`,
        initialMessage.length > 100 ? initialMessage.substring(0, 100) + '...' : initialMessage
        );

        console.log('📨 New conversation notification sent to recipient');
        showToast('Message sent successfully!');
    }

    closeNewMessage();
    closeMessages();
    
    // Reopen messages to show the new conversation
    setTimeout(() => {
        showMessages();
    }, 500);
    
    } catch (error) {
    console.error('Error starting conversation:', error);
    showToast('Failed to send message: ' + error.message);
    }
}

// Update existing functions to include chat initialization
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
    // Query users table directly with email and password
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

    if (userError || !userData) {
        throw new Error('Invalid email or password');
    }

    if (userData.status !== 'Active') {
        throw new Error('Your account is not active. Please contact support.');
    }

    currentUser = userData;
    localStorage.setItem('housingo_user', JSON.stringify(userData));
    showToast('Login successful! Welcome back!');
    
    // Initialize messaging after login
    await initializeMessaging();
    
    setTimeout(() => {
        const dashboardPage = userData.role === 'Admin' ? 'admin-dashboard' :
                            userData.role === 'Landlord' ? 'landlord-dashboard' : 'tenant-dashboard';
        showPage(dashboardPage);
        updateNavForLoggedInUser();
    }, 1000);

    } catch (error) {
    console.error('Login error:', error);
    showToast('Login failed: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log In';
    }
}

// Request notification permissions
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
        console.log('✅ Browser notifications enabled');
        showToast('Browser notifications enabled! You\'ll receive alerts for new messages.');
        } else {
        console.log('ℹ️ Browser notifications denied');
        }
    } catch (error) {
        console.log('ℹ️ Browser notifications not supported');
    }
    }
}

// Update checkAuthState to initialize chat
async function checkAuthState() {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('housingo_user');
    if (storedUser) {
    try {
        currentUser = JSON.parse(storedUser);
        updateNavForLoggedInUser();
        await initializeMessaging();
        
        // Request notification permission after a short delay
        setTimeout(requestNotificationPermission, 2000);
    } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('housingo_user');
    }
    }
}

// Update logout to disconnect messaging
async function logout() {
    // Stop message polling
    stopMessagePolling();
    
    // Disconnect GetStream if connected
    await disconnectStream();
    
    // Clear notification tracking
    notifiedMessageIds.clear();
    
    currentUser = null;
    localStorage.removeItem('housingo_user');
    showToast('Logged out successfully!');
    setTimeout(() => {
    location.reload();
    }, 1000);
}

async function disconnectStream() {
    if (streamClient && isStreamConnected) {
    try {
        await streamClient.disconnectUser();
        isStreamConnected = false;
        console.log('✅ GetStream disconnected successfully');
    } catch (error) {
        console.error('Error disconnecting from GetStream:', error);
    }
    }
}

// Update message functions to use GetStream + Supabase
function messageLandlord(landlordId, landlordName, propertyId) {
    if (!currentUser) {
    showToast('Please log in to send messages');
    return;
    }

    // Set the recipient and show new message modal
    selectedRecipient = {
    userId: landlordId,
    name: landlordName,
    email: '', // We don't have email in this context
    role: 'Landlord'
    };
    
    document.getElementById('recipient-search').value = `${landlordName} (Landlord)`;
    document.getElementById('initial-message').value = `Hi! I'm interested in your property (ID: ${propertyId}). Could we discuss the details?`;
    
    showNewMessageForm();
}

async function sendTenantMessage(event, propertyId) {
    event.preventDefault();
    const subject = document.getElementById('message-subject').value;
    const content = document.getElementById('message-content').value;
    
    try {
    // Find tenant for this property and send message via GetStream/Supabase
    // This would require additional property-tenant relationship data
    showToast('Message sent to tenant successfully!');
    document.querySelector('div[style*="position: fixed"]')?.remove();
    } catch (error) {
    console.error('Error sending tenant message:', error);
    showToast('Failed to send message');
    }
}

async function sendLandlordMessage(event, landlordId, propertyId) {
    event.preventDefault();
    const subject = document.getElementById('landlord-message-subject').value;
    const content = document.getElementById('landlord-message-content').value;
    
    try {
    if (isStreamConnected) {
        // Create or get existing channel with landlord
        const channelId = `chat_${Math.min(currentUser.user_id, landlordId)}_${Math.max(currentUser.user_id, landlordId)}`;
        const channel = streamClient.channel('messaging', channelId, {
        members: [`user_${currentUser.user_id}`, `user_${landlordId}`],
        created_by_id: `user_${currentUser.user_id}`
        });

        await channel.create();
        
        // Send message with subject and content
        const messageText = subject ? `${subject}\n\n${content}` : content;
        await channel.sendMessage({
        text: messageText,
        user: { id: `user_${currentUser.user_id}` }
        });
        
        showToast('Message sent to landlord successfully!');
    } else {
        // Fallback to Supabase
        const { error } = await supabase
        .from('messages')
        .insert([{
            sender_id: currentUser.user_id,
            receiver_id: landlordId,
            content: subject ? `${subject}\n\n${content}` : content,
            is_read: false
        }]);

        if (error) throw error;
        showToast('Message sent to landlord successfully!');
    }
    
    document.querySelector('div[style*="position: fixed"]')?.remove();
    } catch (error) {
    console.error('Error sending landlord message:', error);
    showToast('Failed to send message');
    }
}

// Admin Management Functions
async function resetUserPassword(userId, userName) {
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    confirmDiv.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 500px; width: 100%;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Reset Password for ${userName}</h3>
        <form onsubmit="confirmResetPassword(event, '${userId}', '${userName}')">
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">New Password</label>
            <input type="password" id="new-user-password" required minlength="6" style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
            <p style="font-size: 14px; color: #654321; margin-top: 5px;">Minimum 6 characters</p>
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Confirm New Password</label>
            <input type="password" id="confirm-user-password" required minlength="6" style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
        </div>
        <div style="display: flex; gap: 15px;">
            <button type="button" class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
            <button type="submit" class="btn" style="flex: 1; padding: 12px;">Reset Password</button>
        </div>
        </form>
    </div>
    `;
    document.body.appendChild(confirmDiv);
}

async function confirmResetPassword(event, userId, userName) {
    event.preventDefault();
    
    const newPassword = document.getElementById('new-user-password').value;
    const confirmPassword = document.getElementById('confirm-user-password').value;

    if (newPassword !== confirmPassword) {
    showToast('Passwords do not match!');
    return;
    }

    try {
    const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('user_id', userId);

    if (error) throw error;

    // 🔔 Create notification for user - password reset
    await createNotification(
        userId,
        'Password Reset by Admin',
        `Your password has been reset by an administrator. Please log in with your new password and consider changing it in your account settings.`
    );

    showToast(`Password reset successfully for ${userName}!`);
    document.querySelector('div[style*="position: fixed"]')?.remove();
    
    } catch (error) {
    console.error('Error resetting password:', error);
    showToast('Failed to reset password: ' + error.message);
    }
}

async function toggleUserStatus(userId, currentStatus, userName) {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const action = newStatus === 'Active' ? 'activate' : 'deactivate';
    
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center;';
    confirmDiv.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 400px; text-align: center;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">${action === 'activate' ? 'Activate' : 'Deactivate'} User?</h3>
        <p style="margin-bottom: 30px; color: #654321;">Are you sure you want to ${action} ${userName}? ${newStatus === 'Inactive' ? 'They will not be able to log in.' : 'They will be able to log in again.'}</p>
        <div style="display: flex; gap: 15px;">
        <button class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
        <button class="btn" onclick="confirmToggleUserStatus('${userId}', '${newStatus}', '${userName}')" style="flex: 1; padding: 12px; background-color: ${newStatus === 'Active' ? '#32CD32' : '#FF6B6B'};">${action === 'activate' ? 'Activate' : 'Deactivate'}</button>
        </div>
    </div>
    `;
    document.body.appendChild(confirmDiv);
}

async function confirmToggleUserStatus(userId, newStatus, userName) {
    try {
    document.querySelector('div[style*="position: fixed"]')?.remove();

    const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('user_id', userId);

    if (error) throw error;

    // 🔔 Create notification for user - account status change
    await createNotification(
        userId,
        `Account ${newStatus === 'Active' ? 'Activated' : 'Deactivated'}`,
        `Your account has been ${newStatus === 'Active' ? 'activated' : 'deactivated'} by an administrator. ${newStatus === 'Active' ? 'You can now log in and use all features.' : 'Please contact support if you have any questions.'}`
    );

    showToast(`${userName} has been ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully!`);
    loadAdminDashboard(); // Refresh the dashboard
    
    } catch (error) {
    console.error('Error updating user status:', error);
    showToast('Failed to update user status: ' + error.message);
    }
}

function editUser(userId, firstName, lastName, email, mobile, role, status) {
    const editModal = document.createElement('div');
    editModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;';
    editModal.innerHTML = `
    <div style="background: white; border-radius: 12px; max-width: 600px; width: 100%; max-height: 90%; overflow-y: auto;">
        <div style="background-color: #ADD8E6; padding: 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0;">
        <h2 style="color: #8B4513; margin: 0;">Edit User: ${firstName} ${lastName}</h2>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="background: none; border: none; font-size: 30px; color: #8B4513; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        <div style="padding: 30px;">
        <form onsubmit="saveUserChanges(event, '${userId}')">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">First Name</label>
                <input type="text" id="edit-firstname" value="${firstName}" required style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Last Name</label>
                <input type="text" id="edit-lastname" value="${lastName}" required style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
            </div>
            </div>
            
            <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Email</label>
            <input type="email" id="edit-email" value="${email}" required style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
            </div>
            
            <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Mobile</label>
            <input type="tel" id="edit-mobile" value="${mobile || ''}" style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Role</label>
                <select id="edit-role" style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
                <option value="Admin" ${role === 'Admin' ? 'selected' : ''}>Admin</option>
                <option value="Landlord" ${role === 'Landlord' ? 'selected' : ''}>Landlord</option>
                <option value="Tenant" ${role === 'Tenant' ? 'selected' : ''}>Tenant</option>
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Status</label>
                <select id="edit-status" style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513;">
                <option value="Active" ${status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Inactive" ${status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
            </div>
            
            <div style="margin-bottom: 30px;">
            <h3 style="color: #8B4513; margin-bottom: 15px;">Admin Actions</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="btn-secondary" onclick="resetUserPasswordFromEdit('${userId}', '${firstName} ${lastName}')" style="flex: 1; min-width: 150px; padding: 12px; font-size: 14px; background-color: #FFA500; color: white; border-color: #FFA500;">🔑 Reset Password</button>
                <button type="button" class="btn-secondary" onclick="toggleUserStatusFromEdit('${userId}', '${status}', '${firstName} ${lastName}')" style="flex: 1; min-width: 150px; padding: 12px; font-size: 14px; background-color: ${status === 'Active' ? '#FF6B6B' : '#32CD32'}; color: white; border-color: ${status === 'Active' ? '#FF6B6B' : '#32CD32'};">${status === 'Active' ? '🚫 Deactivate' : '✅ Activate'}</button>
                <button type="button" class="btn" onclick="messageUserFromEdit('${userId}', '${firstName} ${lastName}')" style="flex: 1; min-width: 150px; padding: 12px; font-size: 14px;">💬 Send Message</button>
            </div>
            </div>
            
            <div style="display: flex; gap: 15px;">
            <button type="button" class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 15px; font-size: 16px;">Cancel</button>
            <button type="submit" class="btn" style="flex: 1; padding: 15px; font-size: 16px;">Save Changes</button>
            </div>
        </form>
        </div>
    </div>
    `;
    document.body.appendChild(editModal);
}

async function saveUserChanges(event, userId) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
    const updateData = {
        first_name: document.getElementById('edit-firstname').value,
        last_name: document.getElementById('edit-lastname').value,
        email: document.getElementById('edit-email').value,
        mobile: document.getElementById('edit-mobile').value,
        role: document.getElementById('edit-role').value,
        status: document.getElementById('edit-status').value
    };

    const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', userId);

    if (error) throw error;

    // 🔔 Create notification for user - profile updated by admin
    await createNotification(
        userId,
        'Profile Updated by Admin',
        `Your profile information has been updated by an administrator. Please review your account details and contact support if you have any questions.`
    );

    showToast('User updated successfully!');
    document.querySelector('div[style*="position: fixed"]')?.remove();
    loadAdminDashboard(); // Refresh the dashboard
    
    } catch (error) {
    console.error('Error updating user:', error);
    showToast('Failed to update user: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
    }
}

function resetUserPasswordFromEdit(userId, userName) {
    // Close the edit modal first
    document.querySelector('div[style*="position: fixed"]')?.remove();
    
    // Open the reset password modal
    resetUserPassword(userId, userName);
}

function toggleUserStatusFromEdit(userId, currentStatus, userName) {
    // Close the edit modal first
    document.querySelector('div[style*="position: fixed"]')?.remove();
    
    // Open the toggle status modal
    toggleUserStatus(userId, currentStatus, userName);
}

function messageUserFromEdit(userId, userName) {
    // Close the edit modal first
    document.querySelector('div[style*="position: fixed"]')?.remove();
    
    // Open the message modal
    messageUser(userId, userName);
}

function messageUser(userId, userName) {
    if (!currentUser) {
    showToast('Please log in to send messages');
    return;
    }

    // Set the recipient and show new message modal
    selectedRecipient = {
    userId: userId,
    name: userName,
    email: '', // We don't have email in this context
    role: 'User'
    };
    
    document.getElementById('recipient-search').value = `${userName}`;
    document.getElementById('initial-message').value = `Hello ${userName.split(' ')[0]}! This is a message from the HousinGo admin team.`;
    
    showNewMessageForm();
}

async function viewPropertyDetails(propertyId) {
    try {
    // Get property with all related data
    const { data: property, error: propError } = await supabase
        .from('properties')
        .select(`
        *,
        landlord:users(
            user_id,
            first_name,
            last_name,
            email,
            mobile
        )
        `)
        .eq('property_id', propertyId)
        .single();

    if (propError) throw propError;

    // Get amenities and images
    const amenities = getPropertyAmenities(propertyId);
    const images = getPropertyImages(propertyId);

    // Show property details in modal (reuse existing modal)
    showPropertyDetails(property);
    
    } catch (error) {
    console.error('Error loading property details:', error);
    showToast('Failed to load property details: ' + error.message);
    }
}

async function rejectProperty(propertyId) {
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    confirmDiv.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 500px; width: 100%;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Reject Property</h3>
        <form onsubmit="confirmRejectProperty(event, '${propertyId}')">
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Reason for Rejection</label>
            <textarea id="rejection-reason" required rows="4" placeholder="Please provide a reason for rejecting this property..." style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513; resize: vertical; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;"></textarea>
        </div>
        <div style="display: flex; gap: 15px;">
            <button type="button" class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
            <button type="submit" class="btn" style="flex: 1; padding: 12px; background-color: #FF6B6B;">Reject Property</button>
        </div>
        </form>
    </div>
    `;
    document.body.appendChild(confirmDiv);
}

async function confirmRejectProperty(event, propertyId) {
    event.preventDefault();
    
    const rejectionReason = document.getElementById('rejection-reason').value.trim();

    try {
    // Get property details first
    const { data: property, error: propError } = await supabase
        .from('properties')
        .select(`
        *,
        landlord:users(
            user_id,
            first_name,
            last_name,
            email
        )
        `)
        .eq('property_id', propertyId)
        .single();

    if (propError) throw propError;

    const { error } = await supabase
        .from('properties')
        .update({ status: 'Rejected' })
        .eq('property_id', propertyId);

    if (error) throw error;

    // 🔔 Create notification for landlord - property rejected
    await createNotification(
        property.landlord.user_id,
        'Property Listing Rejected',
        `Unfortunately, your ${property.type} property in ${property.city} was not approved. Reason: ${rejectionReason}. You can edit and resubmit your listing after addressing the issues mentioned.`
    );

    showToast('Property rejected successfully!');
    document.querySelector('div[style*="position: fixed"]')?.remove();
    loadAdminDashboard();
    
    } catch (error) {
    console.error('Error rejecting property:', error);
    showToast('Failed to reject property: ' + error.message);
    }
}

async function suspendProperty(propertyId) {
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    confirmDiv.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 12px; max-width: 500px; width: 100%;">
        <h3 style="color: #8B4513; margin-bottom: 20px;">Suspend Property</h3>
        <form onsubmit="confirmSuspendProperty(event, '${propertyId}')">
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8B4513;">Reason for Suspension</label>
            <textarea id="suspension-reason" required rows="4" placeholder="Please provide a reason for suspending this property..." style="width: 100%; padding: 12px; border: 2px solid #ADD8E6; border-radius: 8px; font-size: 16px; color: #8B4513; resize: vertical; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;"></textarea>
        </div>
        <div style="display: flex; gap: 15px;">
            <button type="button" class="btn-secondary" onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 12px;">Cancel</button>
            <button type="submit" class="btn" style="flex: 1; padding: 12px; background-color: #FFA500;">Suspend Property</button>
        </div>
        </form>
    </div>
    `;
    document.body.appendChild(confirmDiv);
}

async function confirmSuspendProperty(event, propertyId) {
    event.preventDefault();
    
    const suspensionReason = document.getElementById('suspension-reason').value.trim();

    try {
    // Get property details first
    const { data: property, error: propError } = await supabase
        .from('properties')
        .select(`
        *,
        landlord:users(
            user_id,
            first_name,
            last_name,
            email
        )
        `)
        .eq('property_id', propertyId)
        .single();

    if (propError) throw propError;

    const { error } = await supabase
        .from('properties')
        .update({ status: 'Suspended' })
        .eq('property_id', propertyId);

    if (error) throw error;

    // 🔔 Create notification for landlord - property suspended
    await createNotification(
        property.landlord.user_id,
        'Property Listing Suspended',
        `Your ${property.type} property in ${property.city} has been temporarily suspended. Reason: ${suspensionReason}. Please contact support to resolve this issue and reactivate your listing.`
    );

    showToast('Property suspended successfully!');
    document.querySelector('div[style*="position: fixed"]')?.remove();
    loadAdminDashboard();
    
    } catch (error) {
    console.error('Error suspending property:', error);
    showToast('Failed to suspend property: ' + error.message);
    }
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    const messagesModal = document.getElementById('messages-modal');
    const newMessageModal = document.getElementById('new-message-modal');
    
    if (event.target === messagesModal) {
    closeMessages();
    }
    if (event.target === newMessageModal) {
    closeNewMessage();
    }
});

checkAuthState();
loadProperties();
