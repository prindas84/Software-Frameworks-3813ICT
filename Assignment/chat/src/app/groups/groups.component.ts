// Angular core modules
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

// Angular HTTP and Forms modules
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; 

// Services
import { AuthoriseService } from '../services/authorise.service';
import { PageMetaService } from '../services/page-meta.service';

// Components
import { AccountMenuComponent } from '../account-menu/account-menu.component';

// Environment file for backend URL configuration
import { environment } from '../../environments/environment';

// URL for the backend API
const BACKEND_URL = environment.BACKEND_URL;

@Component({
    selector: 'app-groups',
    standalone: true,
    imports: [CommonModule, FormsModule, AccountMenuComponent],  // Import necessary modules and components
    templateUrl: './groups.component.html',
    styleUrl: './groups.component.css'
})
export class GroupsComponent implements OnInit {

    groups: any[] = [];              // Array to store the list of groups
    currentUser: any = {};           // Object to hold the current user's details
    showErrorMessage: string = '';   // Holds the error message to display on operation failures
    showSuccessMessage: string = ''; // Holds the success message to display on operation successes
    newGroupName: string = '';       // Holds the new group name entered by the user

    constructor(
        private http: HttpClient,                 // HTTP client for making requests to the backend server
        private router: Router,                   // Router service for handling navigation
        private pageMetaService: PageMetaService, // Service to manage page metadata, such as the page title
        private authService: AuthoriseService     // Service to manage authentication-related tasks
    ) {
        // Set the page title to 'Groups' when this component is initialised
        this.pageMetaService.setTitle('Groups');
    }

    ngOnInit(): void {
        // Check if the user is logged in
        const isLoggedIn = this.authService.checkLoginStatus();

        if (isLoggedIn) {
            // Retrieve the current user's details
            this.currentUser = this.authService.getUser();

            // Fetch the list of groups when the component is initialised
            this.fetchGroups();
        }
    }

    // Method to fetch the updated list of groups from the server
    fetchGroups(): void {
        const fetchGroupsObserver = {
            next: (data: any[]) => {
                this.groups = data;
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to load groups';
                setTimeout(() => {
                    this.router.navigate(['/account']);
                }, 2000);
            },
            complete: () => {
                setTimeout(() => {
                    this.showErrorMessage = '';  // Clear error message after delay
                }, 2000);
            }
        };

        this.http.get<any[]>(`${BACKEND_URL}/api/groups/groups`).subscribe(fetchGroupsObserver); // Adjusted URL
    }

    // Method to create a new group
    createGroup() {
        if (!this.newGroupName) {
            this.showErrorMessage = 'ERROR: Please enter a group name.';
            setTimeout(() => {
                this.showErrorMessage = '';
            }, 2000);
            return;
        }

        const newGroup = {
            groupName: this.newGroupName,
            creatorUsername: this.currentUser.username
        };

        const createGroupObserver = {
            next: (data: any) => {
                if (data.success) {
                    this.groups.push(data.group); 
                    this.showSuccessMessage = data.message;
                    this.newGroupName = '';  // Clear the input field after successful creation
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to create group';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        this.http.post(`${BACKEND_URL}/api/groups/createGroup`, newGroup).subscribe(createGroupObserver);
    }

    // Method to navigate to the group view page
    viewGroup(groupId: number): void {
        this.router.navigate(['/view-group'], { queryParams: { groupNumber: groupId } });
    }

    // Method to add the current user as an admin in a group
    addGroupAdmin(group: any) {
        const joinData = {
            groupId: group.id,
            username: this.currentUser.username
        };
    
        const joinGroupObserver = {
            next: (data: any) => {
                if (data.success) {
                    if (!group.admins?.some((admin: any) => admin.username === this.currentUser.username)) {
                        group.admins.push(this.currentUser);  // Add current user to admin list
                    }
    
                    this.groups = this.groups.map(g => g.id === group.id ? group : g);  // Update the group list
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to join group';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };
    
        this.http.post(`${BACKEND_URL}/api/groups/addGroupAdmin`, joinData).subscribe(joinGroupObserver);
    }

    // Method to leave a group
    leaveGroup(group: any) {
        const leaveData = {
            groupId: group.id,
            username: this.currentUser.username
        };
    
        const leaveGroupObserver = {
            next: (data: any) => {
                if (data.success) {
                    group.admins = group.admins?.filter((admin: any) => admin.username !== this.currentUser.username) || [];
                    group.members = group.members?.filter((member: any) => member.username !== this.currentUser.username) || [];

                    this.groups = this.groups.map(g => g.id === group.id ? group : g);  // Update the group list
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to leave group';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };
    
        this.http.post(`${BACKEND_URL}/api/groups/leaveGroup`, leaveData).subscribe(leaveGroupObserver);
    }

    // Method to register the current user for a group
    registerForGroup(group: any) {
        const registerData = {
            groupId: group.id,
            username: this.currentUser.username
        };
    
        const registerObserver = {
            next: (data: any) => {
                if (data.success) {
                    group.interested?.push(this.currentUser);  // Add the user to the group's interested list

                    this.groups = this.groups.map(g => g.id === group.id ? group : g);  // Update the group list
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to register for the group';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };
    
        this.http.post(`${BACKEND_URL}/api/groups/register`, registerData).subscribe(registerObserver);
    }

    // Method to deregister the current user from a group
    deregisterFromGroup(group: any) {
        const deregisterData = {
            groupId: group.id,
            username: this.currentUser.username
        };

        const deregisterObserver = {
            next: (data: any) => {
                if (data.success) {
                    group.interested = group.interested?.filter((user: any) => user.username !== this.currentUser.username) || [];
                    
                    this.groups = this.groups.map(g => g.id === group.id ? group : g);  // Update the group list
                    this.showSuccessMessage = data.message;
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to deregister from the group';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        this.http.post(`${BACKEND_URL}/api/groups/deregister`, deregisterData).subscribe(deregisterObserver);
    }
    
    // Method to delete a group
    deleteGroup(group: any) {
        const deleteGroupObserver = {
            next: (data: any) => {
                if (data.success) {
                    this.groups = this.groups.filter(g => g.id !== group.id);  // Remove the group from the list
                    this.showSuccessMessage = data.message;
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to delete group';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        this.http.delete(`${BACKEND_URL}/api/groups/deleteGroup/${group.id}`).subscribe(deleteGroupObserver);
    }

    // Method to check if the current user is banned from a group
    isBanned(group: any): boolean {
        return group.banned?.some((bannedUser: any) => bannedUser.id === this.currentUser.id) || false;
    }

    // Method to get all groups created by the current user
    getMyGroups(): any[] {
        return this.groups.filter(group => 
            group.creator.username === this.currentUser.username ||
            group.admins?.some((user: any) => user.username === this.currentUser.username) ||
            group.members?.some((user: any) => user.username === this.currentUser.username)
        );
    }

    // Method to get all groups where the current user is registered
    getRegisteredGroups(): any[] {
        return this.groups.filter(group => 
            group.interested?.some((user: any) => user.username === this.currentUser.username)
        );
    }

    // Method to get all groups where the user is neither the creator, admin, member, nor interested
    getAllGroups(): any[] {
        return this.groups.filter(group => 
            group.creator.username !== this.currentUser.username &&
            !group.admins?.some((user: any) => user.username === this.currentUser.username) &&
            !group.members?.some((user: any) => user.username === this.currentUser.username) &&
            !group.interested?.some((user: any) => user.username === this.currentUser.username)
        );
    }
}
