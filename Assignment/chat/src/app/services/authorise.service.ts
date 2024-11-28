// Angular core modules
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

// RxJS modules
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root' // This service will be provided at the root level, making it a singleton
})
export class AuthoriseService {

    // BehaviourSubject to track login status; initialised with the result of checkInitialLoginStatus()
    private loggedIn = new BehaviorSubject<boolean>(this.checkInitialLoginStatus());

    // User object to store the logged-in user's details
    user: any = {};

    constructor(private router: Router) { }

    // Private method to check the initial login status from sessionStorage
    private checkInitialLoginStatus(): boolean {
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            return sessionStorage.getItem('isLoggedIn') === 'true';
        }
        return false; // Return false if sessionStorage is not available
    }

    // Getter to expose the login status as an observable
    get isLoggedIn() {
        return this.loggedIn.asObservable();
    }

    // Method to check the current login status and handle navigation if not logged in
    checkLoginStatus(): boolean {
        const isLoggedIn = this.loggedIn.getValue();

        if (!isLoggedIn) {
            this.router.navigate(['/login']); // Redirect to the login page if not logged in
            return false;
        }

        // If logged in, retrieve the user details from sessionStorage
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            const userData = sessionStorage.getItem('user');
            if (userData) {
                this.user = JSON.parse(userData); // Parse and store the user data
            }
        }

        return true; // Return true if the user is logged in
    }

    // Method to get the currently logged-in user's details
    getUser(): any {
        return this.user;
    }

    setUser(user: any): void {
        // Update the local user object
        this.user = user;
    
        // Store the user data in sessionStorage
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('user', JSON.stringify({
                id: user.id,
                username: user.username,
                password: user.password,
                email: user.email,
                firstName: user.firstName,
                surname: user.surname,
                avatar: user.avatar,
                permission: user.permission,
                active: user.active,
            }));
        }
    }

    // Method to handle user login; stores user data in sessionStorage
    loginUser(data: any): void {
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('isLoggedIn', 'true'); // Set login status to true
            sessionStorage.setItem('user', JSON.stringify({
                id: data.user.id,
                username: data.user.username,
                password: data.user.password,
                email: data.user.email,
                firstName: data.user.firstName,
                surname: data.user.surname,
                avatar: data.user.avatar,
                permission: data.user.permission,
                active: data.user.active,
            }));
        }
        this.loggedIn.next(true); // Update the BehaviourSubject to reflect the login status
        this.router.navigate(['/account']);  // Redirect to the account page
    }

    // Method to handle user logout; clears sessionStorage and updates the login status
    logoutUser() {
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('isLoggedIn', 'false'); // Set login status to false
            sessionStorage.removeItem('user'); // Remove user data from sessionStorage
        }
        this.loggedIn.next(false); // Update the BehaviourSubject to reflect the logout status
        this.router.navigate(['/login']); // Redirect to the login page after logout
    }

    // Method to validate the registration fields; returns an error message or null if valid
    validateRegistration(user: any): string | null {
        let errorMessage = '';

        // Check if each required field is filled out; append error message if not
        if (!user.username) {
            errorMessage += '<strong>REQUIRED:</strong> Please Enter a Username<br>';
        }
        if (!user.password) {
            errorMessage += '<strong>REQUIRED:</strong> Please Enter a Password<br>';
        }
        if (!user.email) {
            errorMessage += '<strong>REQUIRED:</strong> Please Enter an Email Address<br>';
        }
        if (!user.firstName) {
            errorMessage += '<strong>REQUIRED:</strong> Please Enter a First Name<br>';
        }
        if (!user.surname) {
            errorMessage += '<strong>REQUIRED:</strong> Please Enter a Surname<br>';
        }

        if (errorMessage) {
            return errorMessage; // Return the error message if any field is missing
        }

        return null; // Return null if all fields are valid
    }
}
