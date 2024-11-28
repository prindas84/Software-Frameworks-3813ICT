// Angular core modules
import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';

// Angular router modules
import { RouterLink, RouterOutlet } from '@angular/router';
// Angular forms module
import { FormsModule } from '@angular/forms';
// Angular HTTP modules
import { HttpClient } from '@angular/common/http';

// Services
import { AuthoriseService } from './services/authorise.service';
import { PageMetaService } from './services/page-meta.service';

// Components
import { AccountComponent } from './account/account.component';
import { LoginComponent } from './login/login.component';
import { VideoChatComponent } from './video-chat/video-chat.component';
import { UsersComponent } from './users/users.component';
import { GroupsComponent } from './groups/groups.component';
import { ViewGroupComponent } from './view-group/view-group.component';

// Configuration
import { httpOptions } from './config/http-config';

// Environment file
import { environment } from '../environments/environment';

// URL for the backend API
const BACKEND_URL = environment.BACKEND_URL;

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,          // Import for common directives like ngIf and ngFor
        RouterOutlet,          // Allows the component to display routed views
        RouterLink,            // Enables the use of routerLink directive in templates
        AccountComponent,      // Importing AccountComponent to be used within this component
        LoginComponent,        // Importing LoginComponent to be used within this component
        VideoChatComponent,    // Importing VideoChatComponent to be used within this component
        UsersComponent,        // Importing UsersComponent to be used within this component
        GroupsComponent,       // Importing GroupsComponent to be used within this component
        ViewGroupComponent,    // Importing ViewGroupComponent to be used within this component
        FormsModule,           // Importing FormsModule to use form directives in the template
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {

    isLoggedIn: boolean = false;   // Tracks if the user is logged in
    isHomepage: boolean = false;   // Tracks if the current page is the homepage

    // User object to store registration details, bound to form inputs
    user: any = {
        username: '',    // Username for registration
        password: '',    // Password for registration
        email: '',       // Email for registration
        firstName: '',   // User's first name
        surname: '',     // User's surname
        avatar: '',      // URL or path to user's avatar
        register: 'user', // Default role set during registration
        active: true,    // Account status, true indicates active
    };

    showErrorMessage: string = '';   // Holds the error message to display on failed registration
    showSuccessMessage: string = ''; // Holds the success message to display on successful registration

    constructor(
        private pageMetaService: PageMetaService,   // Service to handle page metadata
        private authService: AuthoriseService,      // Service to handle authorisation logic
        private router: Router,                     // Angular Router to manage navigation
        private httpClient: HttpClient,             // HTTP client for making requests to the server
    ) {
        // Set the initial title of the page to 'Homepage'
        this.pageMetaService.setTitle('Homepage');
    }

    ngOnInit(): void {

        // Subscribe to changes in the isLoggedIn observable to update the login state
        this.authService.isLoggedIn.subscribe(
            (loggedIn: boolean) => {
                this.isLoggedIn = loggedIn;
            }
        );

        // Subscribe to router events to determine if the current route is the homepage
        this.router.events.subscribe(event => {
            if (event instanceof NavigationEnd) {
                this.isHomepage = event.urlAfterRedirects === '/';
            }
        });

        // If the 'isLoggedIn' value isn't set in sessionStorage, initialise it to 'false'
        if (!sessionStorage.getItem('isLoggedIn')) {
            sessionStorage.setItem('isLoggedIn', 'false');
        }

        // Set the initial login state based on sessionStorage value
        this.isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    }

    // Method to handle user logout
    onLogout(event: Event): void {
        event.preventDefault();  // Prevent the default anchor behavior
        this.authService.logoutUser();
    }

    // Method to handle form submission for registration
    onSubmit() {
        // Validate registration fields using the AuthoriseService
        const fieldsCheck = this.authService.validateRegistration(this.user);
        if (fieldsCheck !== null) {
            // Show error message if any field is incomplete or invalid
            this.showErrorMessage = fieldsCheck as string;
            setTimeout(() => {
                this.showErrorMessage = '';
            }, 2000);
        } else {
            // Define the observer to handle the response from the registration request
            const registerObserver = {
                next: (data: any) => {
                    if (data.success) {
                        // Successful registration: Log the user in, store details, and navigate to account page
                        this.authService.loginUser(data);
                        this.showSuccessMessage = data.message;
                        setTimeout(() => {
                            // Reset the user object to clear fields on page reload
                            this.user = {
                                username: '',
                                password: '',
                                email: '',
                                firstName: '',
                                surname: '',
                                avatar: '',
                                register: 'user',
                                active: true
                            };
                        }, 2000);
                    } else {
                        // Failed registration: Show error message
                        this.showErrorMessage = data.message;
                    }
                },
                error: (err: any) => {
                    // Handle server error: Show a generic error message
                    this.showErrorMessage = 'An error occurred. Please try again later.';
                },
                complete: () => {
                    setTimeout(() => {
                        this.showSuccessMessage = '';
                        this.showErrorMessage = '';
                    }, 2000);
                }
            };

            // Send the registration request using HTTP POST and subscribe to the observer
            this.httpClient.post(BACKEND_URL + '/api/users/register', this.user, httpOptions).subscribe(registerObserver);
        }
    }
}
