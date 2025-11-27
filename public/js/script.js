// Global Variables
let allCountries = [];
let selectedCountries = new Set();
let filteredCountries = [];
let currentFocus = -1;
let selectedFiles = [];
let contactCount = 1;
let formContacts = [];
let pdfUrl = '';

$(document).ready(function() {
    // Initialize all components
    initializeBrandSelection();
    initializeKeyContactPerson();
    initializeFileUpload();
    initializeContactSections();
    initializeCountryData();
    initializeContactTypeHandling();
    initializeFormSubmission();
    initializeRefreshButton();
});

// ========== Brand Selection ==========
function initializeBrandSelection() {
    $(document).on('click', '.brand-icon', function() {
        $(this).toggleClass('selected');
    });
}

// ========== Key Contact Person Selection ==========
function initializeKeyContactPerson() {
    $(document).on('click', '.btn-outline-secondary', function() {
        $('.btn-outline-secondary').removeClass('active').css({
            'backgroundColor': '',
            'color': '',
            'borderColor': ''
        });
        
        $(this).addClass('active').css({
            'backgroundColor': '#E2131C',
            'color': 'white',
            'borderColor': '#E2131C'
        });
    });
}

// ========== File Upload ==========
function initializeFileUpload() {
    $('#addFileBtn').on('click', function() {
        $('#fileInput').click();
    });

    $('#fileInput').on('change', function(e) {
        const files = e.target.files;
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                selectedFiles.push(file);
                addFileBadge(file);
            }
            $(this).val('');
        }
    });
}

function addFileBadge(file) {
    const $fileBadge = $('<div>', {
        class: 'file-badge me-2 mb-2',
        html: `
            <span>${file.name}</span>
            <button type="button" class="btn-close" aria-label="Remove"></button>
        `
    });

    $fileBadge.data('fileObject', file);

    $fileBadge.find('.btn-close').on('click', function() {
        const index = selectedFiles.indexOf(file);
        if (index > -1) {
            selectedFiles.splice(index, 1);
        }
        $fileBadge.remove();
    });

    $('#filePreviewContainer').append($fileBadge);
}

window.getSelectedFiles = function() {
    return selectedFiles;
};

// ========== Contact Sections Management ==========
function initializeContactSections() {
    updateRemoveButtons();

    $(document).on('click', '.add-contact-btn', function() {
        addContactSection();
    });

    $(document).on('click', '.remove-contact-btn', function() {
        if ($('.contact-section').length > 1) {
            $(this).closest('.contact-section').remove();
            contactCount--;
            updateRemoveButtons();
        }
    });
}

function addContactSection() {
    contactCount++;
    const $newSection = $('.contact-section').first().clone();

    $newSection.find('h5').text(`Contact Information ${contactCount}`);

    $newSection.find('input, select').each(function() {
        const id = $(this).attr('id');
        if (id) {
            const baseId = id.split('_')[0];
            $(this).attr('id', `${baseId}_${contactCount}`).val('');
        }
    });

    $newSection.find('label').each(function() {
        const forAttr = $(this).attr('for');
        if (forAttr) {
            const baseFor = forAttr.split('_')[0];
            $(this).attr('for', `${baseFor}_${contactCount}`);
        }
    });

    $newSection.find('.remove-contact-btn').prop('disabled', false);

    $('.contact-section-container').append($newSection);
    updateRemoveButtons();

    populatePhoneCodeDropdown(`_${contactCount}`);
}

function updateRemoveButtons() {
    const $removeButtons = $('.remove-contact-btn');
    $removeButtons.prop('disabled', $('.contact-section').length <= 1);
}

// ========== Country Data & Search ==========
function initializeCountryData() {
    fetchCountries()
        .then(() => {
            populatePhoneCodeDropdown('_1');
            setupCountrySearch();
        })
        .catch(error => {
            console.error("Failed to initialize country data:", error);
        });
}

async function fetchCountries() {
    try {
        const response = await $.ajax({
            url: 'https://country-api.drnyeinchan.com/v1/countries',
            method: 'GET'
        });
        allCountries = response;
        console.log("Countries fetched:", allCountries);
    } catch (error) {
        console.error("Error fetching countries:", error);
        $('#countrySearchInput').attr('placeholder', 'Error loading countries. Type to search.').prop('disabled', true);
        $('#countryCode_1').html('<option value="">Error loading countries.</option>');
    }
}

function populatePhoneCodeDropdown(containerIdSuffix = '_1') {
    const $selectElement = $(`#countryCode${containerIdSuffix}`);

    if ($selectElement.length === 0 || allCountries.length === 0) {
        console.warn(`Dropdown element #countryCode${containerIdSuffix} not found or countries not loaded.`);
        return;
    }

    $selectElement.empty();
    $selectElement.append('<option value="" disabled selected>Select Code</option>');

    allCountries.forEach(country => {
        $selectElement.append(
            `<option value="${country.phone_code}">
                ${country.phone_code} (${country.name})
            </option>`
        );
    });

    // Show the select normally (no input)
    $selectElement.show();
}


function updateCodeDropdown($input, $dropdown, $selectElement) {
    const value = $input.val().toLowerCase();
    $dropdown.empty();

    const filtered = allCountries.filter(country =>
        country.phone_code.toLowerCase().includes(value) ||
        country.name.toLowerCase().includes(value)
    );

    if (filtered.length === 0) {
        $dropdown.append('<div class="dropdown-item disabled">No matching codes</div>');
    } else {
        filtered.forEach(country => {
            const $item = $('<div>', {
                class: 'dropdown-item',
                text: `${country.phone_code} (${country.name})`
            });

            $item.on('click', function() {
                $input.val(country.phone_code);
                $selectElement.val(country.phone_code);
                $dropdown.hide();
            });

            $dropdown.append($item);
        });
    }
}

function setupCountrySearch() {
    const $searchInput = $('#countrySearchInput');
    const $suggestionsDropdown = $('#countrySuggestionsDropdown');
    const $placeholder = $('#selectedCountriesPlaceholder');

    if ($searchInput.length === 0 || $suggestionsDropdown.length === 0) {
        console.warn('Country search input or suggestions dropdown not found.');
        return;
    }

    $searchInput.on('focus', function() {
        if ($(this).val().trim() !== '') {
            showSuggestions($searchInput, $suggestionsDropdown);
        }
    });

    $searchInput.on('input', function() {
        const searchTerm = $(this).val().toLowerCase().trim();
        
        if (searchTerm === '') {
            filteredCountries = [...allCountries];
            $suggestionsDropdown.hide();
            return;
        }

        filteredCountries = allCountries.filter(country =>
            country.name.toLowerCase().includes(searchTerm) ||
            country.code.toLowerCase().includes(searchTerm) ||
            country.phone_code.includes(searchTerm)
        );

        showSuggestions($searchInput, $suggestionsDropdown);
    });

    $searchInput.on('blur', function() {
        setTimeout(() => $suggestionsDropdown.hide(), 200);
    });

    $searchInput.on('keydown', function(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            addActive($suggestionsDropdown);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            addActive($suggestionsDropdown);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const $children = $suggestionsDropdown.children();
            if (currentFocus > -1 && $children.eq(currentFocus).length) {
                $children.eq(currentFocus).click();
            } else if (filteredCountries.length > 0) {
                selectCountry(filteredCountries[0].name, $searchInput);
            }
        } else if (e.key === 'Tab') {
            $suggestionsDropdown.hide();
        }
    });

    if ($placeholder.length && selectedCountries.size === 0) {
        $placeholder.show();
    }
}

function showSuggestions($searchInput, $suggestionsDropdown) {
    $suggestionsDropdown.empty().show();
    currentFocus = -1;

    if (filteredCountries.length === 0) {
        $suggestionsDropdown.append('<div class="dropdown-item disabled">No countries found.</div>');
        return;
    }

    filteredCountries.forEach(country => {
        const $item = $('<div>', {
            class: 'dropdown-item',
            html: `${country.flag} ${country.name} (${country.code}, ${country.phone_code})`,
            'data-country-name': country.name
        });

        $item.on('mousedown', function(e) {
            e.preventDefault();
            selectCountry(country.name, $searchInput);
            $searchInput.val('').focus();
            $suggestionsDropdown.hide();
        });

        $suggestionsDropdown.append($item);
    });
}

function addActive($dropdown) {
    const $children = $dropdown.children();
    if ($children.length === 0) return;
    
    removeActive($dropdown);
    
    if (currentFocus >= $children.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = $children.length - 1;
    
    $children.eq(currentFocus).addClass('active')[0].scrollIntoView({ block: 'nearest' });
}

function removeActive($dropdown) {
    $dropdown.children().removeClass('active');
}

function selectCountry(countryName, $searchInput) {
    if (!selectedCountries.has(countryName)) {
        selectedCountries.add(countryName);
        updateSelectedCountriesDisplay();
        updateHiddenInput();
    }
}

function updateSelectedCountriesDisplay() {
    const $container = $('#selectedCountriesContainer');
    const $placeholder = $('#selectedCountriesPlaceholder');
    
    if ($container.length === 0) return;

    $container.empty();

    if (selectedCountries.size === 0) {
        if ($placeholder.length) {
            $placeholder.show();
        }
        return;
    }

    if ($placeholder.length) {
        $placeholder.hide();
    }

    selectedCountries.forEach(countryName => {
        const $badge = $('<span>', {
            class: 'badge rounded-pill bg-primary d-flex align-items-center',
            css: { cursor: 'pointer' },
            html: `
                ${countryName}
                <span class="ms-2 btn-close btn-close-white" style="font-size: 0.7em;" aria-label="Remove"></span>
            `
        });

        $badge.on('click', function(e) {
            if ($(e.target).hasClass('btn-close')) {
                selectedCountries.delete(countryName);
                updateSelectedCountriesDisplay();
                updateHiddenInput();
            }
        });

        $container.append($badge);
    });
}

function updateHiddenInput() {
    $('#targetMarketsInput').val(Array.from(selectedCountries).join(','));
}

// ========== Contact Type Handling ==========
function initializeContactTypeHandling() {
    $('#contactType').on('change', function() {
        const value = $(this).val();
        
        if (value === '') {
            $('#businessInfoSection, #contactInfoSection, #brandInfoSection, #keycontactSection, #attachmentSection, #commentSection, #submitSection, #newsletterSection').hide();
        } else if (value === 'supplier' || value === 'customer') {
            $('#businessInfoSection, #contactInfoSection, #brandInfoSection, #keycontactSection, #attachmentSection, #commentSection, #submitSection, #newsletterSection').show();
        } else if (value === 'other') {
            $('#brandInfoSection').hide();
            $('#businessInfoSection, #contactInfoSection, #keycontactSection, #attachmentSection, #commentSection, #submitSection, #newsletterSection').show();
        }
    });
}

// ========== Form Submission ==========
// ========== Form Submission ==========
async function initializeFormSubmission() {
    $('#mainForm').on('submit', async function (e) {
        e.preventDefault();

        const formData = collectFormData();
        const fd = new FormData();

        fd.append('contactType', $('#contactType').val());
        fd.append('businessName', formData.businessInfo.businessName);
        fd.append('category', formData.businessInfo.category);
        fd.append('country', formData.businessInfo.country);
        fd.append('website', formData.businessInfo.website);
        fd.append('targetMarkets', formData.businessInfo.targetMarkets.join(','));
        fd.append('newsletter', formData.newsletter);
        fd.append('comment', formData.comments);
        fd.append('otherBrand', formData.otherBrand || '');
        fd.append('contacts', JSON.stringify(formData.contacts));
        fd.append('brands', formData.brands.join(','));
        fd.append('keyContactPerson', formData.keyContactPerson);

        selectedFiles.forEach(f => fd.append('attachments', f));

        try {
            const res = await fetch('/api/submit-form', { method: 'POST', body: fd });
            const result = await res.json();

            if (result.success) {
                window.lastSubmittedPDF = {
                    pdfBase64: result.pdfBase64,
                    pdfFileName: result.pdfFileName,
                    pdfLink: result.pdfLink // from backend (Google Drive public link)
                };

                showMessagingOptions(formData.contacts);
            }
        } catch (err) {
            console.error("Form submission error:", err);
        }
    });
}

function collectFormData() {
    // Business Information
    const businessInfo = {
        businessName: $('#businessName').val() || '',
        category: $('#category').val() || '',
        country: $('#country').val() || '',
        website: $('#website').val() || '',
        targetMarkets: $('#targetMarketsInput').val().split(',').filter(name => name !== '')
    };

    // Contacts
    const contacts = [];
    $('.contact-section').each(function(i){
        contacts.push({
            name: $(`#name_${i+1}`).val() || '',
            countryCode: $(`#countryCode_${i+1}`).val() || '',
            phone: $(`#phone_${i+1}`).val() || '',
            email: $(`#email_${i+1}`).val() || '',
            occupation: $(`#occupation_${i+1}`).val() || '',
            language: $(`#language_${i+1}`).val() || '',
            whatsappCode: $(`#whatsappCode_${i+1}`).val() || '',
            whatsapp: $(`#whatsapp_${i+1}`).val() || ''
        });
    });

    // Selected Brands
    const selectedBrands = Array.from($('.brand-icon.selected')).map(el => {
        const img = el.querySelector('img');
        return img ? img.alt : '';
    });

    // Key Contact Person
    const activeButton = $('.btn-outline-secondary.active');
    const keyContactPerson = activeButton.length ? activeButton.text() : '';

    // Comments
    const comments = $('#commentTextarea').val() || '';

    // Newsletter
    const newsletter = $('#newsletter').is(':checked');

    // Other Brand
    const otherBrand = $('#otherBrand').val() || '';

    return {
        businessInfo,
        contacts,
        brands: selectedBrands,
        otherBrand,
        keyContactPerson,
        comments,
        newsletter
    };
}



function showMessagingOptions(contacts) {

       const modalHtml = `
        <div class="modal fade" id="messagingModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Send Messages</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <h6>Send WhatsApp Message</h6>
                  <div id="whatsappContacts">
                    ${contacts.map((contact, index) =>
                        (contact.phone || contact.whatsapp) ?
                            `<div class="form-check mb-2">
                        <input class="form-check-input" type="radio" name="whatsappContact" 
                               id="whatsapp_${index}" value="${index}">
                        <label class="form-check-label" for="whatsapp_${index}">
                          ${contact.name} - ${contact.phone ? `${contact.countryCode} ${contact.phone}` : `${contact.whatsappCode} ${contact.whatsapp}`}
                        </label>
                      </div>` : ''
                    ).join('')}
                  </div>
                  <button type="button" class="btn btn-success mt-2" id="sendWhatsAppBtn">
                    Send
                  </button>
                </div>
                
                <div class="mb-3">
                  <h6>Send Email</h6>
                  <div id="emailContacts">
                    ${contacts.map((contact, index) =>
                        contact.email ?
                            `<div class="form-check mb-2">
                        <input class="form-check-input" type="radio" name="emailContact" 
                               id="email_${index}" value="${index}">
                        <label class="form-check-label" for="email_${index}">
                          ${contact.name} - ${contact.email}
                        </label>
                      </div>` : ''
                    ).join('')}
                  </div>
                  <button type="button" class="btn btn-primary mt-2" id="sendEmailBtn">
                    Send 
                  </button>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

    const $modalContainer = $('<div>').html(modalHtml);
    $('body').append($modalContainer);

    const modal = new bootstrap.Modal(document.getElementById('messagingModal'));
    modal.show();


    $('#sendWhatsAppBtn').on('click', () => {
        const selected = $('input[name="whatsappContact"]:checked');
        if (!selected.length) return alert('Select a WhatsApp contact');

        const contact = contacts[parseInt(selected.val())];
        const pdfUrl = window.lastSubmittedPDF.pdfLink;

        const msg = encodeURIComponent(
            `Hello ${contact.name},\nHere is your file:\n${pdfUrl}`
        );

        const cleaned = contact.phone.replace(/[^0-9]/g, "");
        const waLink = `https://wa.me/${cleaned}?text=${msg}`;

        window.open(waLink, "_blank");
    });


    $('#sendEmailBtn').on('click', async () => {
        const selected = $('input[name="emailContact"]:checked');
        if (!selected.length) return alert('Select an email contact');

        const contact = contacts[parseInt(selected.val())];

        const fd = new FormData();
        fd.append('to', contact.email);
        fd.append('subject', 'SAMDO Auto Parts - Inquiry Confirmation');
        fd.append('body', `Hello ${contact.name},\n\nPlease find your PDF attached.\n\nBest regards,\nSAMDO Team`);

        // Convert base64 → file
        const pdfBlob = b64toBlob(window.lastSubmittedPDF.pdfBase64, 'application/pdf');
        fd.append('attachment', pdfBlob, window.lastSubmittedPDF.pdfFileName);

        try {
            const res = await fetch('/api/send-email', { method: 'POST', body: fd });
            const data = await res.json();

            if (data.success) alert('Email sent successfully!');
            else alert('Failed to send email: ' + data.message);

        } catch (err) {
            console.error(err);
            alert('Error sending email');
        }
    });

    $('#messagingModal').on('hidden.bs.modal', () => $modalContainer.remove());
}



// Utility: base64 → Blob
function b64toBlob(b64Data, contentType) {
    const byteCharacters = atob(b64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}


// ========== Refresh Button ==========
function initializeRefreshButton() {
    $('#refreshPageBtn').on('click', function() {
        window.location.reload();
    });
}