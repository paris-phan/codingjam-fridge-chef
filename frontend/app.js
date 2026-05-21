/* ==========================================================================
   FRIDGECHEF - Frontend Application State & Interactivity
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let ingredients = [];
    let currentChef = 'grandma';

    // --- DOM Elements ---
    const body = document.body;
    const form = document.getElementById('recipe-form');
    
    // State Views
    const stateInput = document.getElementById('state-input');
    const stateLoading = document.getElementById('state-loading');
    const stateRecipe = document.getElementById('state-recipe');
    
    // Tag Input Elements
    const tagContainer = document.getElementById('tag-container');
    const ingredientInput = document.getElementById('ingredient-input');
    const btnGenerate = document.getElementById('btn-generate');
    const quickChips = document.querySelectorAll('.quick-add-chips .chip');
    
    // Chef Selector Elements
    const chefCards = document.querySelectorAll('.chef-card');
    
    // Loading Message Rotator
    const loadingTxt = document.getElementById('loading-txt');
    
    // Recipe View Elements
    const btnBack = document.getElementById('btn-back');
    const recipeTitle = document.getElementById('recipe-title');
    const recipeDesc = document.getElementById('recipe-desc');
    const recipePrep = document.getElementById('recipe-prep');
    const recipeDifficulty = document.getElementById('recipe-difficulty');
    const recipeImage = document.getElementById('recipe-image');
    const recipeIngredientsContainer = document.getElementById('recipe-ingredients');
    const recipeStepsContainer = document.getElementById('recipe-steps');
    const recipeChefBadge = document.getElementById('recipe-chef-badge');
    
    // Chef Tip Elements
    const chefTipAvatar = document.getElementById('chef-tip-avatar');
    const chefTipName = document.getElementById('chef-tip-name');
    const recipeChefNote = document.getElementById('recipe-chef-note');

    // Loading State Humorous Phrases
    const loadingPhrases = [
        "Consulting the chef's secret recipe books...",
        "Preheating the digital skillet...",
        "Chucking the ingredients into the mixing bowl...",
        "Whisking with high-velocity vigor...",
        "Chopping the onions without shedding a tear...",
        "Sizzling the garlic on medium heat...",
        "Plating with absolute culinary precision...",
        "Applying a delicate pinch of seasoning...",
        "Capturing the perfect steam for the photo..."
    ];
    let phraseInterval = null;

    // --- State Transition Utility ---
    function switchState(stateName) {
        // Deactivate all states first
        stateInput.classList.remove('active');
        stateLoading.classList.remove('active');
        stateRecipe.classList.remove('active');

        // Stop loading interval if we are leaving loading state
        if (stateName !== 'loading' && phraseInterval) {
            clearInterval(phraseInterval);
            phraseInterval = null;
        }

        // Activate target state with slight delay to ensure browser register transition
        setTimeout(() => {
            if (stateName === 'input') {
                stateInput.classList.add('active');
            } else if (stateName === 'loading') {
                stateLoading.classList.add('active');
                startLoadingMessages();
            } else if (stateName === 'recipe') {
                stateRecipe.classList.add('active');
            }
        }, 50);
    }

    // --- Loading Screen Text Rotator ---
    function startLoadingMessages() {
        let index = 0;
        loadingTxt.textContent = loadingPhrases[index];
        phraseInterval = setInterval(() => {
            index = (index + 1) % loadingPhrases.length;
            loadingTxt.style.opacity = 0;
            setTimeout(() => {
                loadingTxt.textContent = loadingPhrases[index];
                loadingTxt.style.opacity = 1;
            }, 300);
        }, 2200);
    }

    // --- Ingredient Tag Management ---
    
    function addIngredient(name) {
        const cleaned = name.trim().toLowerCase();
        if (!cleaned) return;
        
        // Prevent duplicate tags
        if (ingredients.includes(cleaned)) {
            ingredientInput.value = '';
            return;
        }
        
        ingredients.push(cleaned);
        renderTags();
        ingredientInput.value = '';
        validateForm();
    }

    function removeIngredient(index) {
        ingredients.splice(index, 1);
        renderTags();
        validateForm();
    }

    function renderTags() {
        // Remove existing tags (keep input)
        const tags = tagContainer.querySelectorAll('.tag');
        tags.forEach(t => t.remove());
        
        // Render new tags
        ingredients.forEach((ing, index) => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag';
            tagSpan.innerHTML = `
                ${capitalize(ing)}
                <button type="button" class="tag-remove" data-index="${index}">&times;</button>
            `;
            
            // Insert before the input field
            tagContainer.insertBefore(tagSpan, ingredientInput);
        });

        // Add event listeners to remove buttons
        tagContainer.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                removeIngredient(index);
            });
        });
    }

    function validateForm() {
        btnGenerate.disabled = ingredients.length === 0;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // --- Tag Input Event Listeners ---

    // Lock in tags with Enter or Comma
    ingredientInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addIngredient(ingredientInput.value.replace(/,/g, ''));
        }
    });

    // Add tag on blur if something is typed
    ingredientInput.addEventListener('blur', () => {
        addIngredient(ingredientInput.value);
    });

    // Focus input when clicking anywhere inside the tag box
    tagContainer.addEventListener('click', (e) => {
        if (e.target === tagContainer) {
            ingredientInput.focus();
        }
    });

    // Preset quick-add chips clicking
    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const val = chip.getAttribute('data-val');
            addIngredient(val);
            // Highlight chip temporarily as visual cue
            chip.style.transform = 'scale(0.95)';
            setTimeout(() => { chip.style.transform = ''; }, 100);
        });
    });

    // --- Chef Selection Handling ---
    chefCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selected class from all
            chefCards.forEach(c => c.classList.remove('selected'));
            
            // Add selected to clicked card
            card.classList.add('selected');
            
            // Get selected value
            const radio = card.querySelector('input[type="radio"]');
            radio.checked = true;
            currentChef = radio.value;
            
            // Update body class to dynamically animate theme background
            body.className = '';
            body.classList.add(`theme-${currentChef}`);
        });
    });

    // --- Submit Recipe Generation (API Call) ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (ingredients.length === 0) return;

        switchState('loading');

        try {
            const response = await fetch('/api/recipe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ingredients: ingredients,
                    chef_personality: currentChef
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to cook recipe.');
            }

            const data = await response.json();
            renderRecipe(data);
            switchState('recipe');

        } catch (error) {
            console.error('Cooking error:', error);
            alert(error.message || 'The kitchen is running short on spices. Please try again!');
            switchState('input');
        }
    });

    // --- Render Recipe Details in UI ---
    function renderRecipe(data) {
        const recipe = data.recipe;
        
        recipeTitle.textContent = recipe.title;
        recipeDesc.textContent = recipe.description;
        recipePrep.textContent = `🕒 ${recipe.prep_time}`;
        recipeDifficulty.textContent = `🍳 ${recipe.difficulty}`;
        recipeChefNote.textContent = recipe.chef_note;

        // Render ingredients with checklist checkboxes
        recipeIngredientsContainer.innerHTML = '';
        recipe.ingredients.forEach(ing => {
            const li = document.createElement('li');
            li.innerHTML = `
                <label class="ingredient-item">
                    <input type="checkbox">
                    <span>${ing}</span>
                </label>
            `;
            recipeIngredientsContainer.appendChild(li);
        });

        // Add visual strike-through functionality on checkbox check
        recipeIngredientsContainer.querySelectorAll('input[type="checkbox"]').forEach(box => {
            box.addEventListener('change', (e) => {
                const label = e.target.closest('.ingredient-item');
                if (e.target.checked) {
                    label.style.opacity = '0.65';
                } else {
                    label.style.opacity = '1';
                }
            });
        });

        // Render cooking steps
        recipeStepsContainer.innerHTML = '';
        recipe.steps.forEach(step => {
            const li = document.createElement('li');
            li.textContent = step;
            recipeStepsContainer.appendChild(li);
        });

        // Configure Chef-Specific Signature Profiles in Output Card
        if (data.chef_personality === 'grandma') {
            recipeChefBadge.textContent = '👵🏼 Grandma Rosie\'s Comfort';
            chefTipAvatar.textContent = '👵🏼';
            chefTipName.textContent = 'Rosie\'s Kitchen Secret';
            recipeChefBadge.style.color = '#ff6f43';
            recipeChefBadge.style.backgroundColor = '#fff3ed';
        } else if (data.chef_personality === 'bistro') {
            recipeChefBadge.textContent = '👨🏻‍🍳 Leo\'s Late-Night Hack';
            chefTipAvatar.textContent = '👨🏻‍🍳';
            chefTipName.textContent = 'Chef Leo\'s Quick Tip';
            recipeChefBadge.style.color = '#00f2fe';
            recipeChefBadge.style.backgroundColor = 'rgba(0, 242, 254, 0.08)';
        } else { // gourmet
            recipeChefBadge.textContent = '👩🏼‍🎨 Penelope\'s Masterpiece';
            chefTipAvatar.textContent = '👩🏼‍🎨';
            chefTipName.textContent = 'Penelope\'s Fine-Dining Technique';
            recipeChefBadge.style.color = '#7a8d6e';
            recipeChefBadge.style.backgroundColor = '#f5f4eb';
        }

        // Render image (or fallback if empty/error)
        if (data.image) {
            recipeImage.src = data.image;
            recipeImage.alt = `Appetizing plate of ${recipe.title}`;
            recipeImage.style.display = 'block';
        } else {
            // High-quality static fallback food placeholder based on category
            recipeImage.src = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80&w=600';
            recipeImage.alt = 'Delicious culinary creation placeholder';
            recipeImage.style.display = 'block';
        }
    }

    // --- Back Button Reset ---
    btnBack.addEventListener('click', () => {
        switchState('input');
    });

});
