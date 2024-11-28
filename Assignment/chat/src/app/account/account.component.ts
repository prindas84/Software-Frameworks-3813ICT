// Angular core modules
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

// Angular forms module
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Angular HTTP modules
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

// Services
import { AuthoriseService } from '../services/authorise.service';
import { PageMetaService } from '../services/page-meta.service';

// Components
import { AccountMenuComponent } from '../account-menu/account-menu.component';

// Configuration
import { httpOptions } from '../config/http-config';

// Environment and RXJS files
import { environment } from '../../environments/environment';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// URL for the backend API
const BACKEND_URL = environment.BACKEND_URL;

@Component({
    selector: 'app-account',
    standalone: true,
    imports: [CommonModule, FormsModule, AccountMenuComponent],  // Importing necessary modules and components
    templateUrl: './account.component.html',
    styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit {

    // Declare the variables to bind to the HTML form
    user: any = {
        id: '',          // User ID
        username: '',    // Username
        password: '',    // User password
        email: '',       // User email
        firstName: '',   // User's first name
        surname: '',     // User's surname
        avatar: '',      // URL or path to user's avatar
        permission: '',  // User's permission level
        active: '',      // Status indicating if the user is active
    };

    selectedFile: File | null = null;   // Holds the upload file
    avatarUrl: string | null = null;    // Holds the avatar file to display 

    showErrorMessage: string = '';      // Holds the error message to display on failed save
    showSuccessMessage: string = '';    // Holds the success message to display on successful save
    showErrorMessageUpload: string = '';      // Holds the error message to display on failed avatar upload
    showSuccessMessageUpload: string = '';    // Holds the success message to display on successful avatar upload

    constructor(
        private pageMetaService: PageMetaService,   // Service to handle page metadata, such as the page title
        private httpClient: HttpClient,             // HTTP client for making requests to the server
        private authService: AuthoriseService,      // Service to manage authentication tasks
        private router: Router                      // Router service for navigation tasks
    ) {
        // Set the title of the page to 'Account' when this component is initialised
        this.pageMetaService.setTitle('Account');
    }

    ngOnInit(): void {
        // Use the AuthService to check if the user is logged in
        const isLoggedIn = this.authService.checkLoginStatus();

        // If the user is logged in, retrieve the user details from the AuthService
        if (isLoggedIn) {
            this.user = this.authService.getUser();
            this.avatarUrl = this.user.avatar ? `${environment.BACKEND_URL}/api/users/avatar?path=${this.user.avatar}` : null;
        }
    }

    // Method to handle the saving of user settings
    onSave(): void {
        // Validate the user fields using the AuthoriseService
        const fieldsCheck = this.authService.validateRegistration(this.user);
        if (fieldsCheck !== null) {
            // Show error message if any field is incomplete or invalid
            this.showErrorMessage = fieldsCheck as string;

            setTimeout(() => {
                this.showErrorMessage = '';
                // Reinitialise the page by navigating to the same route to refresh the view
                this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
                    this.router.navigate(['/account']);
                });
            }, 2000);
            return;
        }

        // Observer to handle the response from the update user request
        const updateUserObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Update the session storage with the new user details
                    sessionStorage.setItem('user', JSON.stringify(data.user));

                    // Successful update: Display success message and refresh the settings page
                    this.showSuccessMessage = data.message;
                } else {
                    // Failed update: Show error message
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                // Handle server error
                this.showErrorMessage = 'An error occurred while saving your profile. Please try again later.';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
                        this.router.navigate(['/account']);
                    });
                }, 2000);
            }
        };

        // Send the update user request using HTTP PUT and subscribe to the observer
        this.httpClient.put(BACKEND_URL + '/api/users/updateUser', this.user, httpOptions).subscribe(updateUserObserver);
    }

    // Method to delete the user's account
    deleteAccount() {
        // Define the observer to handle the response from the delete request
        const deleteObserver = {
            next: (response: any) => {
                if (response.success) {
                    this.authService.logoutUser();
                } else {
                    // Handle the case where deletion was not successful
                    this.showErrorMessage = response.message;
                }
            },
            error: (err: any) => {
                // Handle server error: Show a generic error message
                this.showErrorMessage = 'An error occurred. Please try again later.';
            },
            complete: () => {
                // Reset the success and error messages after a short delay
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send a DELETE request to the server to delete the user by their ID and subscribe to the observer
        this.httpClient.delete(`${BACKEND_URL}/api/users/deleteUser/${this.user.id}`).subscribe(deleteObserver);
    }

    // Method to handle user logout
    onLogout() {
        // Call the AuthService to log out the user
        this.authService.logoutUser();  
    }

    // Handle file selection for avatar upload
    onFileSelected(event: Event): void {
        const fileInput = event.target as HTMLInputElement;
        if (fileInput.files && fileInput.files[0]) {
            this.selectedFile = fileInput.files[0];
        }
    }

    // Handle avatar upload submission
    onUploadAvatar(): void {
        if (!this.selectedFile) {
            this.showErrorMessageUpload = 'Please select a file first';
            setTimeout(() => {
                this.showErrorMessageUpload = '';
            }, 2000);
            return;
        }

        const formData = new FormData();
        formData.append('avatar', this.selectedFile);

        this.httpClient.post(`${BACKEND_URL}/api/users/upload-avatar/${this.user.id}`, formData)
            .pipe(
                catchError((error: HttpErrorResponse) => {
                    console.error('Upload error:', error);
                    this.showErrorMessageUpload = 'Failed to upload avatar. Please try again.';
                    setTimeout(() => {
                        this.showErrorMessageUpload = '';
                    }, 2000);
                    return of(null);
                })
            )
            .subscribe((response: any) => {
                if (response.success) {
                    this.showSuccessMessageUpload = 'Avatar uploaded successfully!';
                    this.authService.setUser(response.user); 

                    // Clear the file input field by accessing it directly
                    const fileInput = document.getElementById('avatarUpload') as HTMLInputElement;
                    if (fileInput) {
                        fileInput.value = ''; // Clear the file input field
                    }
                    this.selectedFile = null; // Reset the selected file reference

                    setTimeout(() => {
                        this.showSuccessMessageUpload = '';
                        this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
                            this.router.navigate(['/account']);
                        });
                    }, 2000);
                }
            });
    }
}
