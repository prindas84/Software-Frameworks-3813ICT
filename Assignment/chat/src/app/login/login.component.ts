// Angular core modules
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

// Angular forms module
import { FormsModule } from '@angular/forms';

// Angular HTTP modules
import { HttpClient } from '@angular/common/http';

// Services
import { AuthoriseService } from '../services/authorise.service';
import { PageMetaService } from '../services/page-meta.service';

// Configuration
import { httpOptions } from '../config/http-config';

// Environment file
import { environment } from '../../environments/environment';

// URL for the backend API
const BACKEND_URL = environment.BACKEND_URL;

@Component({
	selector: 'app-login',
	standalone: true,
	imports: [FormsModule],  // Importing FormsModule to use form directives in the template
	templateUrl: './login.component.html',
	styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

	// Bound to the username input field
	username: string = '';           

	// Bound to the password input field
	password: string = '';           

	// Holds the error message to display on failed login
	showErrorMessage: string = '';   

	// Holds the success message to display on successful login
	showSuccessMessage: string = ''; 

	constructor(
		private pageMetaService: PageMetaService,   // Service to handle page metadata, such as the page title
		private router: Router,                     // Router service for navigation tasks
		private httpClient: HttpClient,             // HTTP client for making requests to the server
		private authoriseService: AuthoriseService  // Service to manage authentication tasks
	) {
        // Set the title of the page to 'Login' when this component is initialised
        this.pageMetaService.setTitle('Login');
    }

	ngOnInit(): void {
		// Subscribe to the isLoggedIn observable to check if the user is already logged in
		this.authoriseService.isLoggedIn.subscribe((loggedIn: boolean) => {
			if (loggedIn) {
				this.router.navigate(['/account']);
			}
		});
	}

	// Method to handle form submission for login
	onSubmit() {
		// Create a user object with the username and password entered by the user
		let user = { username: this.username, password: this.password };

		// Define the observer to handle the response from the login request
		const loginObserver = {
			next: (data: any) => {
				if (data.success && data.user?.active) {
					// Successful login: Set session as logged in, store user details, and navigate to account page
					this.authoriseService.loginUser(data);
					this.showSuccessMessage = data.message;
				} else {
					// Failed login: Show error message and reset the form after a delay
					this.showErrorMessage = data.message;
				}
			},
			error: (err: any) => {
				// Handle server error: Show a generic error message
				this.showErrorMessage = 'An error occurred. Please try again later.';
			},
			complete: () => {
				setTimeout(() => {
					this.username = '';
					this.password = '';
					this.showSuccessMessage = '';
					this.showErrorMessage = '';
				}, 2000);
			}
		};

		// Send the login request using HTTP POST and subscribe to the observer
		this.httpClient.post(BACKEND_URL + '/api/users/auth', user, httpOptions).subscribe(loginObserver);
	}
}
