const BUCKET_STORAGE_KEY = "uslist_bucket_items";
const MEMORY_STORAGE_KEY = "uslist_memories";


// ==================== STORAGE ====================

function getBucketItems() {

    return JSON.parse(
        localStorage.getItem(BUCKET_STORAGE_KEY)
    ) || [];

}


function getMemories() {

    return JSON.parse(
        localStorage.getItem(MEMORY_STORAGE_KEY)
    ) || [];

}


function saveBucketItems(items) {

    localStorage.setItem(
        BUCKET_STORAGE_KEY,
        JSON.stringify(items)
    );

}


// ==================== DASHBOARD ====================

function updateDashboard() {

    const bucketItems = getBucketItems();
    const memories = getMemories();


    const total = bucketItems.length;

    const completed =
        bucketItems.filter(
            item => item.completed
        ).length;

    const remaining =
        total - completed;


    const progress =
        total === 0
            ? 0
            : Math.round(
                (completed / total) * 100
            );


    // ==================== STATISTICS ====================

    const statCards =
        document.querySelectorAll(
            ".stat-card strong"
        );


    if (statCards.length >= 4) {

        statCards[0].textContent = total;

        statCards[1].textContent = completed;

        statCards[2].textContent =
            memories.length;

        statCards[3].textContent =
            `${progress}%`;

    }


    // ==================== PROGRESS ====================

    const progressValue =
        document.querySelector(
            ".progress-inner strong"
        );


    if (progressValue) {

        progressValue.textContent =
            `${progress}%`;

    }


    const progressCircle =
        document.querySelector(
            ".progress-circle"
        );


    if (progressCircle) {

        const degrees =
            progress * 3.6;


        progressCircle.style.background = `
            conic-gradient(
                var(--primary)
                0deg
                ${degrees}deg,

                var(--primary-soft)
                ${degrees}deg
                360deg
            )
        `;

    }


    // ==================== PROGRESS DETAILS ====================

    const progressDetails =
        document.querySelectorAll(
            ".progress-details > div strong"
        );


    if (progressDetails.length >= 2) {

        progressDetails[0].textContent =
            completed;

        progressDetails[1].textContent =
            remaining;

    }


    // ==================== NEXT ADVENTURE ====================

    updateNextAdventure(bucketItems);

}


// ==================== NEXT ADVENTURE ====================

function updateNextAdventure(items) {

    const activeItems =
        items.filter(
            item => !item.completed
        );


    const adventureTitle =
        document.querySelector(
            ".adventure-content h4"
        );


    const adventureDescription =
        document.querySelector(
            ".adventure-content p"
        );


    const adventureCategory =
        document.querySelector(
            ".adventure-content > span"
        );


    const completeButton =
        document.querySelector(
            ".complete-button"
        );


    if (!adventureTitle) {
        return;
    }


    // ==================== EMPTY ====================

    if (activeItems.length === 0) {

        adventureTitle.textContent =
            "Your next adventure";


        adventureDescription.textContent =
            "Add something to your bucket list and it will appear here.";


        adventureCategory.textContent =
            "Bucket List";


        if (completeButton) {

            completeButton.style.display =
                "none";

        }


        return;

    }


    // ==================== NEXT ITEM ====================

    const nextItem =
        activeItems[0];


    adventureTitle.textContent =
        nextItem.title;


    adventureDescription.textContent =
        nextItem.description ||
        "Something special to experience together.";


    adventureCategory.textContent =
        nextItem.category;


    if (completeButton) {

        completeButton.style.display =
            "flex";


        completeButton.onclick = () => {

            completeBucketItem(
                nextItem.id
            );

        };

    }

}


// ==================== COMPLETE ITEM ====================

function completeBucketItem(id) {

    const items =
        getBucketItems();


    const updatedItems =
        items.map(item => {

            if (item.id !== id) {
                return item;
            }


            return {

                ...item,

                completed: true,

                completedAt:
                    new Date().toISOString()

            };

        });


    saveBucketItems(
        updatedItems
    );


    updateDashboard();

}


// ==================== MOBILE SIDEBAR ====================

const menuButton =
    document.getElementById(
        "menuButton"
    );


const sidebar =
    document.getElementById(
        "sidebar"
    );


const sidebarClose =
    document.getElementById(
        "sidebarClose"
    );


if (menuButton && sidebar) {

    menuButton.addEventListener(
        "click",
        () => {

            sidebar.classList.add(
                "open"
            );

        }
    );

}


if (sidebarClose && sidebar) {

    sidebarClose.addEventListener(
        "click",
        () => {

            sidebar.classList.remove(
                "open"
            );

        }
    );

}


document.addEventListener(
    "click",
    event => {

        if (
            window.innerWidth <= 850 &&
            sidebar &&
            sidebar.classList.contains(
                "open"
            ) &&
            !sidebar.contains(
                event.target
            ) &&
            !menuButton.contains(
                event.target
            )
        ) {

            sidebar.classList.remove(
                "open"
            );

        }

    }
);


// ==================== INITIALIZE ====================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateDashboard();

    }
);