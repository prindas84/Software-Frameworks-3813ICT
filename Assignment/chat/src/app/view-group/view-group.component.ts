// Angular core modules
import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
    selector: 'app-view-group',
    standalone: true,
    imports: [CommonModule, FormsModule, AccountMenuComponent],  // Import necessary modules and components
    templateUrl: './view-group.component.html',
    styleUrls: ['./view-group.component.css']
})
export class ViewGroupComponent implements OnInit {

    currentUser: any = {};                // Object to hold the current user's details
    showErrorMessage: string = '';        // Holds error messages for failed operations
    showSuccessMessage: string = '';      // Holds success messages for successful operations
    groupNumber: number | boolean = false;  // Stores the group number from query parameters
    group: any = null;                    // Object to store the group details
    newChannelName: string = '';          // Stores the name of the new channel to be created

    constructor(
        private http: HttpClient,                  // HTTP client for making requests to the backend server
        private router: Router,                    // Router service for handling navigation
        private activatedRoute: ActivatedRoute,    // ActivatedRoute to access route query parameters
        private pageMetaService: PageMetaService,  // Service to handle page metadata, such as the page title
        private authService: AuthoriseService      // Service to manage authentication tasks
    ) {
        // Set the title of the page to 'View Group' when this component is initialised
        this.pageMetaService.setTitle('View Group');
    }

    ngOnInit(): void {
        // Check if the user is logged in
        const isLoggedIn = this.authService.checkLoginStatus();

        if (isLoggedIn) {
            // Retrieve the current user's details
            this.currentUser = this.authService.getUser();

            // Subscribe to query parameters to get the group number
            this.activatedRoute.queryParams.subscribe(params => {
                this.groupNumber = params['groupNumber'] ? +params['groupNumber'] : false;

                if (this.groupNumber) {
                    // Observer to handle the response when fetching the group data
                    const fetchGroupObserver = {
                        next: (data: any) => {
                            if (data.success === false || !data) {
                                // If the response indicates failure, redirect to the groups page
                                this.router.navigate(['/groups']);
                            } else {
                                this.group = data;  // Store the fetched group details
                            }
                        },
                        error: (err: any) => {
                            // Handle errors in the HTTP request
                            this.router.navigate(['/groups']);
                        }
                    };

                    // Build the URL using the userID from the currentUser object
                    const userID = this.currentUser.id;
                    const url = `${BACKEND_URL}/api/groups/view-group/${this.groupNumber}${userID ? `?userID=${userID}` : ''}`;

                    // Fetch the group data from the server
                    this.http.get<any>(url).subscribe(fetchGroupObserver);
                } else {
                    // Redirect to the groups page if no group number is provided
                    this.router.navigate(['/groups']);
                }
            });
        }
    }

    // Method to check if the user is a group admin
    isGroupAdmin(): boolean {
        if (!this.group || !this.currentUser) {
            return false;
        }

        return (
            this.group.creator.username === this.currentUser.username ||
            this.currentUser.permission === 'super-admin' ||
            this.group.admins.some((admin: any) => admin.username === this.currentUser.username)
        );
    }

    // Method to promote a member to an admin role
    addGroupAdmin(group: any, member: any) {
        const joinData = {
            groupId: group.id,
            username: member.username,
        };

        const joinGroupObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Add the selected member to the group's admin array
                    if (!group.admins.some((admin: any) => admin.username === member.username)) {
                        group.admins.push(member);
                    }
                    // Remove the selected member from the group's members array
                    group.members = group.members.filter((m: any) => m.username !== member.username);
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to promote member to admin';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the request to promote the member to admin
        this.http.post(`${BACKEND_URL}/api/groups/addGroupAdmin`, joinData).subscribe(joinGroupObserver);
    }

    // Method to remove an admin
    removeAdmin(group: any, admin: any) {
        const removeData = {
            groupId: group.id,
            adminUsername: admin.username,
            requestingUser: this.currentUser
        };

        const removeAdminObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Remove the user from the group's admins list
                    group.admins = group.admins.filter((a: any) => a.username !== admin.username);

                    // Optionally add them to the members list if they are demoted to a member
                    if (!group.members.some((member: any) => member.username === admin.username)) {
                        group.members.push(admin);
                    }

                    this.showSuccessMessage = 'Admin removed successfully.';
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to remove admin';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the request to remove the admin
        this.http.post(`${BACKEND_URL}/api/groups/removeAdmin`, removeData).subscribe(removeAdminObserver);
    }

    // Method to approve a user's registration to the group
    approveRegistration(group: any, user: any) {
        const approveData = {
            groupId: group.id,
            userUsername: user.username,
            requestingUser: this.currentUser
        };

        const approveObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Add the user to the group's members array
                    if (!group.members.some((member: any) => member.username === user.username)) {
                        group.members.push(user);
                    }
                    // Remove the user from the interested and banned lists
                    group.interested = group.interested.filter((interestedUser: any) => interestedUser.username !== user.username);
                    group.banned = group.banned.filter((bannedUser: any) => bannedUser.username !== user.username);
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to approve registration';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the request to approve the user's registration
        this.http.post(`${BACKEND_URL}/api/groups/approveRegistration`, approveData).subscribe(approveObserver);
    }

    // Method to reject a user's registration from the group
    rejectRegistration(group: any, interestedUser: any) {
        const deregisterData = {
            groupId: group.id,
            username: interestedUser.username,
        };

        const deregisterObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Remove the user from the group's interested array
                    group.interested = group.interested.filter((user: any) => user.username !== interestedUser.username);
                    this.showSuccessMessage = data.message;
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to deregister user';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the request to reject the user's registration
        this.http.post(`${BACKEND_URL}/api/groups/deregister`, deregisterData).subscribe(deregisterObserver);
    }

    // Method to remove a user from the group
    removeUser(group: any, user: any) {
        const removeData = {
            groupId: group.id,
            userUsername: user.username,
            requestingUser: this.currentUser
        };

        const removeObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Remove the user from the group's members, admins, and interested lists
                    group.members = group.members.filter((member: any) => member.username !== user.username);
                    group.admins = group.admins.filter((admin: any) => admin.username !== user.username);
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to remove user';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the request to remove the user from the group
        this.http.post(`${BACKEND_URL}/api/groups/removeUser`, removeData).subscribe(removeObserver);
    }

    // Method to ban a user from the group
    banUser(group: any, user: any) {
        const banData = {
            groupId: group.id,
            username: user.username,
        };

        const banObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Remove the user from all lists and add them to the banned list
                    group.admins = group.admins.filter((admin: any) => admin.username !== user.username);
                    group.members = group.members.filter((member: any) => member.username !== user.username);
                    group.interested = group.interested.filter((interested: any) => interested.username !== user.username);

                    // Add the user to the banned list if not already present
                    if (!group.banned.some((bannedUser: any) => bannedUser.username === user.username)) {
                        group.banned.push(user);
                    }
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to ban user';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the request to ban the user
        this.http.post(`${BACKEND_URL}/api/groups/banUser`, banData).subscribe(banObserver);
    }

    // Method to leave the group
    leaveGroup(group: any) {
        const leaveData = {
            groupId: group.id,
            username: this.currentUser.username
        };

        const leaveGroupObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Remove the user from the group's admins or members list
                    group.admins = group.admins.filter((admin: any) => admin.username !== this.currentUser.username);
                    group.members = group.members.filter((member: any) => member.username !== this.currentUser.username);
                    this.router.navigate(['/groups']);  // Navigate back to the groups page after leaving
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

        // Send the request to leave the group
        this.http.post(`${BACKEND_URL}/api/groups/leaveGroup`, leaveData).subscribe(leaveGroupObserver);
    }

    // Method to delete the group
    deleteGroup(group: any) {
        const deleteGroupObserver = {
            next: (data: any) => {
                if (data.success) {
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

        // Send the request to delete the group
        this.http.delete(`${BACKEND_URL}/api/groups/deleteGroup/${group.id}`).subscribe(deleteGroupObserver);
    }

    // Method to create a new channel in the group
    createChannel() {
        if (this.newChannelName.trim() !== '') {
            const channelData = {
                groupId: this.group.id,          // Pass the group ID
                channelName: this.newChannelName,  // The new channel name
                currentUser: this.currentUser
            };
    
            // Observer to handle the response for creating a new channel
            const createChannelObserver = {
                next: (data: any) => {
                    if (data.success) {
                        // Add the newly created channel to the group
                        this.group.channels.push(data.channel);
                        this.showSuccessMessage = data.message;
                    } else {
                        this.showErrorMessage = data.message;
                    }
                },
                error: (err: any) => {
                    this.showErrorMessage = 'Failed to create channel. Please try again later.';
                },
                complete: () => {
                    setTimeout(() => {
                        this.newChannelName = '';  // Reset the channel name input
                        this.showSuccessMessage = '';
                        this.showErrorMessage = '';
                    }, 2000);
                }
            };
    
            // Send the request to create the channel
            this.http.post(`${BACKEND_URL}/api/groups/createChannel`, channelData).subscribe(createChannelObserver);
        } else {
            // Show error if the channel name is empty
            this.showErrorMessage = 'Channel name cannot be empty';
            setTimeout(() => {
                this.newChannelName = '';
                this.showErrorMessage = '';
            }, 2000);
        }
    }

    // Method to delete a channel from the group
    deleteChannel(channel: any) {
        const deleteData = {
            groupId: this.group.id,
            channelId: channel.id,
            currentUser: this.currentUser
        };

        const deleteChannelObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Remove the deleted channel from the group's channels array
                    this.group.channels = this.group.channels.filter((c: any) => c.id !== channel.id);
                    this.showSuccessMessage = data.message;
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to delete channel';
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the request to delete the channel
        this.http.post(`${BACKEND_URL}/api/groups/deleteChannel`, deleteData).subscribe(deleteChannelObserver);
    }

    // Method to start a video chat in a channel
    startVideoChat(groupId: number, channelId: number): void {
        // Prepare the data for the request
        const channelData = {
            groupId: groupId,
            channelId: channelId,
            currentUser: this.currentUser
        };
    
        // Define the observer for adding the user to the channel for video chat
        const addMemberObserver = {
            next: (data: any) => {
                if (data.success) {
                    // If successful, navigate to the video chat page
                    this.router.navigate(['/video-chat'], {
                        queryParams: { groupNumber: groupId, channelNumber: channelId }
                    });
                } else {
                    this.showErrorMessage = data.message;
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'An error occurred while trying to join the channel for video chat';
            }
        };
    
        // Send the request to add the user to the channel members or admins
        this.http.post(`${BACKEND_URL}/api/groups/addChannelMembers`, channelData).subscribe(addMemberObserver);
    }
}
