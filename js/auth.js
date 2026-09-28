import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


import {
    auth,
    db
} from "../firebase/config.js";



// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════

const INTERNAL_DOMAIN = "users.uslist.app";



// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function normalizeUsername(username) {

    return username
        .trim()
        .toLowerCase();

}


function usernameToInternalEmail(username) {

    return `${normalizeUsername(username)}@${INTERNAL_DOMAIN}`;

}



// ═══════════════════════════════════════════
// COUPLE CONNECTION
// ═══════════════════════════════════════════

function generateInviteCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";


    for (let i = 0; i < 6; i++) {

        code += characters.charAt(
            Math.floor(
                Math.random() *
                characters.length
            )
        );

    }


    return code;

}



// ═══════════════════════════════════════════
// CREATE COUPLE
// ═══════════════════════════════════════════


async function createCouple() {

    const user = auth.currentUser;

    if (!user) {
        throw new Error("You must be logged in.");
    }

    const userRef = doc(db, "users", user.uid);

    let userSnap = await getDoc(userRef);

    // Recreate profile if missing
    if (!userSnap.exists()) {

        console.log("User profile missing — recreating.");

        const username =
            user.email?.split("@")[0]?.toLowerCase() || "user";

        await setDoc(userRef, {
            uid: user.uid,
            username: username,
            usernameLower: username,
            coupleId: null,
            createdAt: serverTimestamp()
        });

        userSnap = await getDoc(userRef);
    }

    const userData = userSnap.data();

    if (userData.coupleId) {
        throw new Error("You are already connected to a couple.");
    }

    // Generate unique invite code
    let inviteCode;
    let existingCouple;

    do {
        inviteCode = generateInviteCode();

        const coupleQuery = query(
            collection(db, "couples"),
            where("inviteCode", "==", inviteCode)
        );

        existingCouple = await getDocs(coupleQuery);

    } while (!existingCouple.empty);

    // Create couple document
    console.log("Creating couple doc with code:", inviteCode);

    const coupleRef = await addDoc(
        collection(db, "couples"),
        {
            member1Uid: user.uid,
            member2Uid: null,
            inviteCode: inviteCode,
            createdAt: serverTimestamp()
        }
    );

    console.log("Couple created:", coupleRef.id);

    // Attach couple ID to user
    console.log("Updating user doc with coupleId");

    await updateDoc(userRef, {
        coupleId: coupleRef.id
    });

    console.log("User updated successfully");

    return {
        coupleId: coupleRef.id,
        inviteCode: inviteCode
    };
}



// ═══════════════════════════════════════════
// JOIN COUPLE
// ═══════════════════════════════════════════

async function joinCouple(
    inviteCode
) {

    const user =
        auth.currentUser;


    if (!user) {

        throw new Error(
            "You must be logged in."
        );

    }



    // Normalize invite code

    const code =
        inviteCode
            .trim()
            .toUpperCase();



    if (!code) {

        throw new Error(
            "Please enter an invite code."
        );

    }



    // Get user profile

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    let userSnap =
        await getDoc(userRef);



    // Recovery:
    // Recreate missing user profile.

    if (!userSnap.exists()) {

        const username =
            user.email
                ?.split("@")[0]
                ?.toLowerCase() ||
            "user";


        await setDoc(
            userRef,
            {
                uid: user.uid,
                username: username,
                usernameLower: username,
                coupleId: null,
                createdAt:
                    serverTimestamp()
            }
        );


        userSnap =
            await getDoc(userRef);

    }



    const userData =
        userSnap.data();



    // Already connected?

    if (userData.coupleId) {

        throw new Error(
            "You are already connected to a couple."
        );

    }



    // Search for invite code

    const coupleQuery =
        query(
            collection(
                db,
                "couples"
            ),
            where(
                "inviteCode",
                "==",
                code
            )
        );


    const coupleSnapshot =
        await getDocs(
            coupleQuery
        );



    // No matching couple

    if (coupleSnapshot.empty) {

        throw new Error(
            "Invalid invite code."
        );

    }



    // Get couple

    const coupleDoc =
        coupleSnapshot.docs[0];


    const coupleData =
        coupleDoc.data();



    // Couple already has two members

    if (coupleData.member2Uid) {

        throw new Error(
            "This invite code has already been used."
        );

    }



    // Prevent joining yourself

    if (
        coupleData.member1Uid ===
        user.uid
    ) {

        throw new Error(
            "You cannot join your own couple."
        );

    }



    // Add second member

    await updateDoc(

        doc(
            db,
            "couples",
            coupleDoc.id
        ),

        {
            member2Uid:
                user.uid
        }

    );



    // Attach couple to user

    await updateDoc(

        userRef,

        {
            coupleId:
                coupleDoc.id
        }

    );



    return {

        coupleId:
            coupleDoc.id

    };

}



// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════

function goToApp() {

    const currentPath =
        window.location.pathname;


    if (
        currentPath.includes(
            "/pages/"
        )
    ) {

        window.location.href =
            "bucket-list.html";

    } else {

        window.location.href =
            "pages/bucket-list.html";

    }

}



function goToLogin() {

    const currentPath =
        window.location.pathname;


    if (
        currentPath.includes(
            "/pages/"
        )
    ) {

        window.location.href =
            "login.html";

    } else {

        window.location.href =
            "pages/login.html";

    }

}



// ═══════════════════════════════════════════
// ERROR MESSAGES
// ═══════════════════════════════════════════

function getAuthErrorMessage(
    error
) {

    console.error(
        "Firebase error:",
        error
    );


    switch (error.code) {

        case "auth/email-already-in-use":

            return (
                "That username is already registered."
            );


        case "auth/invalid-email":

            return (
                "Please enter a valid username."
            );


        case "auth/weak-password":

            return (
                "Password must be at least 6 characters."
            );


        case "auth/invalid-credential":

        case "auth/wrong-password":

        case "auth/user-not-found":

            return (
                "Incorrect username or password."
            );


        case "auth/too-many-requests":

            return (
                "Too many attempts. Please try again later."
            );


        case "auth/network-request-failed":

            return (
                "Network error. Check your internet connection."
            );


        default:

            return (
                error.message ||
                "Something went wrong. Please try again."
            );

    }

}



// ═══════════════════════════════════════════
// SHOW / HIDE ERROR
// ═══════════════════════════════════════════

function showError(
    message
) {

    const errorElement =
        document.getElementById(
            "authError"
        );


    if (!errorElement) {
        return;
    }


    errorElement.textContent =
        message;


    errorElement.hidden =
        false;

}



function clearError() {

    const errorElement =
        document.getElementById(
            "authError"
        );


    if (!errorElement) {
        return;
    }


    errorElement.textContent =
        "";


    errorElement.hidden =
        true;

}



// ═══════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════

async function registerUser(
    username,
    password
) {

    const normalizedUsername =
        normalizeUsername(
            username
        );



    if (!normalizedUsername) {

        throw new Error(
            "Please enter a username."
        );

    }



    if (
        normalizedUsername.length < 3
    ) {

        throw new Error(
            "Username must be at least 3 characters."
        );

    }



    if (
        password.length < 6
    ) {

        throw new Error(
            "Password must be at least 6 characters."
        );

    }



    const email =
        usernameToInternalEmail(
            normalizedUsername
        );



    try {


        // Create Firebase account

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;



        // Create Firestore profile

        await setDoc(

            doc(
                db,
                "users",
                user.uid
            ),

            {

                uid:
                    user.uid,

                username:
                    normalizedUsername,

                usernameLower:
                    normalizedUsername,

                coupleId:
                    null,

                createdAt:
                    serverTimestamp()

            }

        );



        console.log(
            "Account created:",
            user.uid
        );



        // Firebase automatically
        // signs the user in.

        goToApp();


    } catch (error) {


        if (error.code) {

            throw new Error(
                getAuthErrorMessage(
                    error
                )
            );

        }


        throw error;

    }

}



// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════

async function loginUser(
    username,
    password
) {

    const normalizedUsername =
        normalizeUsername(
            username
        );



    if (!normalizedUsername) {

        throw new Error(
            "Please enter your username."
        );

    }



    if (!password) {

        throw new Error(
            "Please enter your password."
        );

    }



    const email =
        usernameToInternalEmail(
            normalizedUsername
        );



    try {


        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        console.log(
            "Logged in:",
            userCredential.user.uid
        );



        // Go to UsList

        goToApp();


    } catch (error) {


        throw new Error(
            getAuthErrorMessage(
                error
            )
        );

    }

}



// ═══════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════

async function logoutUser() {

    try {


        await signOut(
            auth
        );


        goToLogin();


    } catch (error) {


        console.error(
            "Logout error:",
            error
        );

    }

}



// ═══════════════════════════════════════════
// AUTH STATE
// ═══════════════════════════════════════════

onAuthStateChanged(
    auth,
    (user) => {


        const currentPage =
            window.location.pathname
                .split("/")
                .pop();



        const isLoginPage =
            currentPage ===
            "login.html";


        const isRegisterPage =
            currentPage ===
            "register.html";


        const isAuthPage =
            isLoginPage ||
            isRegisterPage;



        const protectedPages = [

            "index.html",

            "bucket-list.html",

            "memories.html",

            "profile.html"

        ];



        const isProtectedPage =
            protectedPages.includes(
                currentPage
            );



        // ═══════════════════════════════
        // LOGGED IN
        // ═══════════════════════════════

        if (user) {


            console.log(
                "Existing Firebase session found:",
                user.uid
            );


            if (isAuthPage) {

                goToApp();

            }


            return;

        }



        // ═══════════════════════════════
        // NOT LOGGED IN
        // ═══════════════════════════════

        if (isProtectedPage) {


            console.log(
                "No Firebase session. Redirecting to login."
            );


            goToLogin();

        }

    }
);



// ═══════════════════════════════════════════
// LOGIN FORM
// ═══════════════════════════════════════════

const loginForm =
    document.getElementById(
        "loginForm"
    );


if (loginForm) {


    loginForm.addEventListener(
        "submit",
        async (event) => {


            event.preventDefault();


            clearError();



            const username =
                document.getElementById(
                    "loginUsername"
                ).value;



            const password =
                document.getElementById(
                    "loginPassword"
                ).value;



            const button =
                document.getElementById(
                    "loginButton"
                );



            try {


                button.disabled =
                    true;


                button
                    .querySelector("span")
                    .textContent =
                    "Logging in...";


                await loginUser(
                    username,
                    password
                );


            } catch (error) {


                showError(
                    error.message
                );


                button.disabled =
                    false;


                button
                    .querySelector("span")
                    .textContent =
                    "Log In";

            }

        }
    );

}



// ═══════════════════════════════════════════
// REGISTER FORM
// ═══════════════════════════════════════════

const registerForm =
    document.getElementById(
        "registerForm"
    );


if (registerForm) {


    registerForm.addEventListener(
        "submit",
        async (event) => {


            event.preventDefault();


            clearError();



            const username =
                document.getElementById(
                    "registerUsername"
                ).value;



            const password =
                document.getElementById(
                    "registerPassword"
                ).value;



            const confirmPassword =
                document.getElementById(
                    "registerConfirmPassword"
                ).value;



            const button =
                document.getElementById(
                    "registerButton"
                );



            try {


                // Confirm password

                if (
                    password !==
                    confirmPassword
                ) {

                    throw new Error(
                        "Passwords do not match."
                    );

                }



                button.disabled =
                    true;


                button
                    .querySelector("span")
                    .textContent =
                    "Creating account...";


                await registerUser(
                    username,
                    password
                );


            } catch (error) {


                showError(
                    error.message
                );


                button.disabled =
                    false;


                button
                    .querySelector("span")
                    .textContent =
                    "Create Account";

            }

        }
    );

}



// ═══════════════════════════════════════════
// PASSWORD VISIBILITY
// ═══════════════════════════════════════════

const passwordToggles =
    document.querySelectorAll(
        ".password-toggle"
    );


passwordToggles.forEach(
    (button) => {


        button.addEventListener(
            "click",
            () => {


                const targetId =
                    button.dataset.target;


                const input =
                    document.getElementById(
                        targetId
                    );


                if (!input) {
                    return;
                }


                const icon =
                    button.querySelector(
                        "i"
                    );



                if (
                    input.type ===
                    "password"
                ) {


                    input.type =
                        "text";


                    icon.classList.remove(
                        "bx-show"
                    );


                    icon.classList.add(
                        "bx-hide"
                    );


                    button.setAttribute(
                        "aria-label",
                        "Hide password"
                    );


                } else {


                    input.type =
                        "password";


                    icon.classList.remove(
                        "bx-hide"
                    );


                    icon.classList.add(
                        "bx-show"
                    );


                    button.setAttribute(
                        "aria-label",
                        "Show password"
                    );

                }

            }
        );

    }
);



// ═══════════════════════════════════════════
// LOGOUT BUTTON
// ═══════════════════════════════════════════

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


if (logoutButton) {


    logoutButton.addEventListener(
        "click",
        logoutUser
    );

}



// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

export {

    registerUser,

    loginUser,

    logoutUser,

    createCouple,

    joinCouple

};