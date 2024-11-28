// Angular core modules
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

// Angular HTTP modules
import { HttpClient } from '@angular/common/http';

// Services
import { AuthoriseService } from '../services/authorise.service';
import { PageMetaService } from '../services/page-meta.service';

// Components
import { AccountMenuComponent } from '../account-menu/account-menu.component';

// Environment file for backend API URL
import { environment } from '../../environments/environment';

// Backend API URL
const BACKEND_URL = environment.BACKEND_URL;

@Component({
    selector: 'app-users',
    standalone: true,
    imports: [CommonModule, AccountMenuComponent],  // Importing necessary modules and components
    templateUrl: './users.component.html',
    styleUrl: './users.component.css'
})
export class UsersComponent implements OnInit {

    users: any[] = [];               // Array to hold the list of users
    reportedUsers: any[] = [];       // Array to hold the list of reported users
    currentUser: any = {};           // Object to store the current user's details
    showErrorMessage: string = '';   // Stores error messages to display on failed operations
    showSuccessMessage: string = ''; // Stores success messages to display on successful operations

    constructor(
        private http: HttpClient,                 // HTTP client for making requests to the backend server
        private router: Router,                   // Router service for handling navigation
        private pageMetaService: PageMetaService, // Service to manage page metadata, such as the page title
        private authService: AuthoriseService     // Service to handle authentication-related tasks
    ) {
        // Set the title of the page to 'Users' when this component is initialised
        this.pageMetaService.setTitle('Users');
    }

    ngOnInit(): void {
        // Check if the user is logged in
        const isLoggedIn = this.authService.checkLoginStatus();

        if (isLoggedIn) {
            // Retrieve the current user's details
            this.currentUser = this.authService.getUser();

            // Only allow 'super-admin' users to access this component
            if (this.currentUser.permission !== 'super-admin') {
                this.router.navigate(['/account']);
                return;
            }

            // Fetch the list of users and reported users
            this.getUsers();
            this.getReportedUsers();
        }
    }

    // Method to fetch the list of users from the server
    getUsers(): void {
        const fetchUsersObserver = {
            next: (data: any[]) => {
                this.users = data;  // Store the fetched users in the users array
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to load users';  // Display error message if fetching fails
                setTimeout(() => {
                    this.showErrorMessage = '';
                    this.router.navigate(['/account']);  // Redirect to the account page after delay
                }, 2000);
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Fetch users from the backend API using the observer
        this.http.get<any[]>(`${BACKEND_URL}/api/users/users`).subscribe(fetchUsersObserver);
    }

    // Method to fetch the list of reported users from the server
    getReportedUsers(): void {
        const getReportedUsersObserver = {
            next: (data: any[]) => {
                this.reportedUsers = data;  // Store the reported users in the reportedUsers array
            },
            error: (error: any) => {
                this.showErrorMessage = 'Failed to load reported users';  // Display error message on failure
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Fetch reported users from the backend API
        this.http.get<any[]>(`${BACKEND_URL}/api/users/getReportedUsers`).subscribe(getReportedUsersObserver);
    }

    // Method to remove a reported user from the reportedUsers array
    removeReportedUser(userId: number): void {
        const removeReportedUserObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Remove the user from the reportedUsers array
                    this.reportedUsers = this.reportedUsers.filter(user => user.user.id !== userId);
                } else {
                    this.showErrorMessage = data.message;  // Display error message if operation fails
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to remove reported user';  // Handle error during removal
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Make HTTP POST request to remove the reported user
        this.http.post(`${BACKEND_URL}/api/users/removeReportedUser`, { userId }).subscribe(removeReportedUserObserver);
    }

    // Method to delete a reported user
    deleteReportedUser(user: any): void {
        this.removeReportedUser(user.id);  // Remove the user from the reported list
        this.deleteUser(user);             // Delete the user
    }

    // Method to ban a reported user
    banReportedUser(user: any): void {
        this.removeReportedUser(user.id);  // Remove the user from the reported list
        this.deactivateUser(user);         // Deactivate the user account
    }

    // Method to set a user as a Super Admin
    setSuperAdmin(user: any): void {
        this.updateUserPermission(user, 'super-admin');
    }

    // Method to set a user as a Group Admin
    setGroupAdmin(user: any): void {
        if (user.id === this.currentUser.id) {
            this.showErrorMessage = "You cannot downgrade your own account from Super Admin.";
            setTimeout(() => {
                this.showErrorMessage = '';
            }, 2000);
            return;
        }
        this.updateUserPermission(user, 'group-admin');
    }

    // Method to set a user as a Chat User
    setChatUser(user: any): void {
        if (user.id === this.currentUser.id) {
            this.showErrorMessage = "You cannot downgrade your own account from Super Admin.";
            setTimeout(() => {
                this.showErrorMessage = '';
            }, 2000);
            return;
        }
        this.updateUserPermission(user, 'chat-user');
    }

    // Method to deactivate a user's account
    deactivateUser(user: any): void {
        const updatedUser = { ...user, active: false };  // Update the user's active status

        const deactivateUserObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Update the user list with the deactivated user
                    this.users = this.users.map(u => u.id === user.id ? data.user : u);
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to deactivate user';  // Handle error during deactivation
            },
            complete: () => {
                setTimeout(() => {
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the updated user details to the backend API
        this.http.put(`${BACKEND_URL}/api/users/updateUser`, updatedUser).subscribe(deactivateUserObserver);
    }

    // Method to reactivate a user's account
    reactivateUser(user: any): void {
        const updatedUser = { ...user, active: true, permission: 'chat-user' };  // Update user to reactivate and reset permission

        const reactivateUserObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Update the user list with the reactivated user
                    this.users = this.users.map(u => u.id === user.id ? data.user : u);
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to reactivate user';  // Handle error during reactivation
            },
            complete: () => {
                setTimeout(() => {
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the updated user details to the backend API
        this.http.put(`${BACKEND_URL}/api/users/updateUser`, updatedUser).subscribe(reactivateUserObserver);
    }

    // Method to delete a user's account
    deleteUser(user: any): void {
        if (user.id === this.currentUser.id) {
            this.showErrorMessage = "You cannot delete your own account.";
            setTimeout(() => {
                this.showErrorMessage = '';
            }, 2000);
            return;
        }

        const deleteUserObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Remove the user from the users array
                    this.users = this.users.filter(u => u.id !== user.id);
                    this.showSuccessMessage = data.message;
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to delete user';  // Handle error during deletion
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send delete request to the backend API
        this.http.delete(`${BACKEND_URL}/api/users/deleteUser/${user.id}`).subscribe(deleteUserObserver);
    }

    // Method to update a user's permission level
    updateUserPermission(user: any, newPermission: string): void {
        const updatedUser = { ...user, permission: newPermission };  // Update user's permission level

        const updateUserObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Update the user in the users array with the new permission
                    this.users = this.users.map(u => u.id === user.id ? data.user : u);
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to update user permission';  // Handle error during update
            },
            complete: () => {
                setTimeout(() => {
                    this.showErrorMessage = '';
                    this.router.navigate(['/users']);  // Navigate back to users page after update
                }, 2000);
            }
        };

        // Send the updated user permission to the backend API
        this.http.put(`${BACKEND_URL}/api/users/updateUser`, updatedUser).subscribe(updateUserObserver);
    }

    // Method to get all Super Admin users
    getSuperAdmins(): any[] {
        return this.users.filter(user => user.permission === 'super-admin' && user.active);
    }

    // Method to get all Group Admin users
    getGroupAdmins(): any[] {
        return this.users.filter(user => user.permission === 'group-admin' && user.active);
    }

    // Method to get all Chat Users
    getChatUsers(): any[] {
        return this.users.filter(user => user.permission === 'chat-user' && user.active);
    }

    // Method to get all inactive users
    getInactiveUsers(): any[] {
        return this.users.filter(user => !user.active);
    }
}
