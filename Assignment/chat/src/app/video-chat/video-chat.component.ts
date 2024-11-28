// Angular core modules
import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Socket.io Client
import { io, Socket } from 'socket.io-client';

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
    selector: 'app-video-chat',
    standalone: true,
    imports: [CommonModule, FormsModule, AccountMenuComponent],  // Importing necessary modules and components
    templateUrl: './video-chat.component.html',
    styleUrl: './video-chat.component.css'
})
export class VideoChatComponent implements OnInit, OnDestroy {

    @ViewChildren('remoteVideo') remoteVideos!: QueryList<ElementRef<HTMLVideoElement>>;

    currentUser: any = {};                // Object to store the current user's details
    showErrorMessage: string = '';        // Stores error messages to display on failed operations
    showSuccessMessage: string = '';      // Stores success messages to display on successful operations
    showReportInput: { [key: number]: boolean } = {};  // Object to track visibility of report input for each user
    reportUserReason: string = '';        // Reason provided by the user for reporting another user
    groupNumber: number | boolean = false;  // Stores the group number from query parameters
    channelNumber: number | boolean = false; // Stores the channel number from query parameters
    group: any = null;                    // Object to store the group's details
    channel: any = null;                  // Object to store the channel's details
    messages: { channelId: number; userId: number; userName: string; messageType: string; message: string; avatar: string }[] = [];   // Store messages
    messageContent: string = '';   // Bind message input field
    private socket!: Socket;   // Socket connection
    defaultIcon: string = 'http://localhost:3000/api/users/avatar?path=/uploads/avatars/user.png';
    selectedFile: File | null = null; // Holds the selected image file
    private ice_candidate_queue: RTCIceCandidate[] = [];
    private remote_description_set: boolean = false;

    // WebRTC variables
    private localStream: MediaStream = new MediaStream();
    private peerConnection: RTCPeerConnection = new RTCPeerConnection(); 
    public remoteStreams: { stream: MediaStream; muted: boolean; userName: string; avatarUrl: string }[] = [];
    incomingCall = false;
    incomingCallerName = '';
    callerId = '';

    constructor(
        private http: HttpClient,                  // HTTP client for making requests to the backend server
        private router: Router,                    // Router service for handling navigation
        private activatedRoute: ActivatedRoute,    // ActivatedRoute to access route query parameters
        private pageMetaService: PageMetaService,  // Service to manage page metadata, such as the page title
        private authService: AuthoriseService      // Service to manage authentication-related tasks
    ) {
        // Set the title of the page to 'View Channel' when this component is initialised
        this.pageMetaService.setTitle('View Channel');
    }

    ngOnInit(): void {
        this.createPeerConnection();  // Ensure peerConnection is created when the component initializes
    
        // Check if the user is logged in
        const isLoggedIn = this.authService.checkLoginStatus();
    
        if (isLoggedIn) {
            // Retrieve the current user's details
            this.currentUser = this.authService.getUser();
    
            // Subscribe to query parameters to get the group number and channel number
            this.activatedRoute.queryParams.subscribe(params => {
                // Extract groupNumber and channelNumber from the query parameters
                this.groupNumber = params['groupNumber'] ? +params['groupNumber'] : false;
                this.channelNumber = params['channelNumber'] ? +params['channelNumber'] : false;
    
                if (this.groupNumber && this.channelNumber) {
                    // Fetch stored messages
                    this.fetchStoredMessages(this.groupNumber, this.channelNumber);
    
                    // Observer to handle the response from the backend API for fetching group and channel data
                    const fetchGroupAndChannelObserver = {
                        next: (response: any) => {
                            if (response.success) {
                                this.group = response.data.group;
                                this.channel = response.data.channel;
                                this.initialiseSocketConnection();
                            } else {
                                this.router.navigate(['/groups']);  // Redirect to groups if fetching fails
                            }
                        },
                        error: (err: any) => {
                            this.router.navigate(['/groups']);  // Redirect on error
                        }
                    };
    
                    // Construct the API URL, passing the userID from the currentUser object
                    const userID = this.currentUser.id;
                    const url = `${BACKEND_URL}/api/groups/view-group/${this.groupNumber}/channel/${this.channelNumber}${userID ? `?userID=${userID}` : ''}`;
    
                    // Fetch the group and channel data from the server
                    this.http.get<any>(url).subscribe(fetchGroupAndChannelObserver);
                } else {
                    // If group number or channel number is missing, redirect to the groups page
                    this.router.navigate(['/groups']);
                }
            });
        }
    }

    ngOnDestroy(): void {
        if (this.socket) this.socket.disconnect();
        if (this.peerConnection) this.peerConnection.close();
    }

    initialiseSocketConnection(): void {
        this.socket = io(BACKEND_URL);
        this.socket.emit('joinChannel', this.channelNumber);
    
        // Listen for incoming messages
        this.socket.on('message', (data: { channelId: number, userId: number, userName: string, messageType: string, message: string, avatar: string }) => {
            this.messages.push({
                channelId: data.channelId,
                userId: data.userId,
                userName: data.userName,
                messageType: data.messageType,
                message: data.message,
                avatar: data.avatar
            });
        });
    
        // Handle incoming 'offer' from another user
        this.socket.on('offer', async ({ sdp, type, senderId, senderName }) => {
            console.log("Incoming offer from:", senderName, "with offer:", { sdp, type });
    
            this.incomingCall = true;
            this.incomingCallerName = senderName;
            this.callerId = senderId;
    
            if (sdp && type) {
                try {
                    this.createPeerConnection();  // Ensure peerConnection is defined
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ sdp, type }));
                    this.remote_description_set = true;
    
                    // Process the ICE candidate queue after setting the remote description
                    this.ice_candidate_queue.forEach(async (queuedCandidate) => {
                        try {
                            await this.peerConnection.addIceCandidate(queuedCandidate);
                        } catch (error) {
                            console.error("Error adding queued ICE candidate:", error);
                        }
                    });
                    this.ice_candidate_queue = [];  // Clear the queue after processing
                } catch (error) {
                    console.error("Failed to set remote description:", error);
                }
            } else {
                console.error("Received invalid offer:", { sdp, type });
            }
        });
    
        // Handle incoming 'answer' from another user
        this.socket.on('answer', async (data) => {
            const answer = data?.answer;  // Unpack answer object
        
            console.log("Received answer:", answer);
        
            if (answer && answer.sdp && answer.type) {
                try {
                    this.createPeerConnection(); // Ensure peerConnection exists
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                    this.remote_description_set = true;
        
                    // Process any queued ICE candidates
                    for (const candidate of this.ice_candidate_queue) {
                        await this.peerConnection.addIceCandidate(candidate);
                    }
                    this.ice_candidate_queue = []; // Clear queue after processing
                } catch (error) {
                    console.error("Failed to set remote description:", error);
                }
            } else {
                console.error("Received invalid answer:", answer);
            }
        });
        
    
        // Handle incoming ICE candidates and queue them if the remote description isn't set
        this.socket.on('ice-candidate', async (candidateData) => {
            const candidate = candidateData.candidate;
            if (candidate && candidate.sdpMid !== null && candidate.sdpMLineIndex !== null) {
                if (this.remote_description_set) {
                    try {
                        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (error) {
                        console.error("Error adding received ICE candidate:", error);
                    }
                } else {
                    this.ice_candidate_queue.push(new RTCIceCandidate(candidate));
                }
            } else {
                console.warn("Received invalid ICE candidate:", candidate);
            }
        });
    }

    private createPeerConnection(): void {
    
        this.peerConnection = new RTCPeerConnection();
    
        // Handle incoming tracks (remote stream)
        this.peerConnection.ontrack = (event) => {
            const incomingStream = event.streams[0];
            if (incomingStream) {
                // Check if the stream is already in remoteStreams to prevent duplicates
                const existingStream = this.remoteStreams.some(rs => rs.stream === incomingStream);
                
                if (!existingStream) {
                    const userName = this.incomingCallerName;
                    const avatarUrl = this.getAvatarUrl(this.currentUser.avatar);
        
                    console.log("Adding new remote stream:", {
                        stream: incomingStream,
                        userName,
                        avatarUrl
                    });
        
                    this.remoteStreams.push({ stream: incomingStream, muted: false, userName, avatarUrl });
                    this.remoteStreams = [...this.remoteStreams]; // Trigger Angular change detection
        
                    console.log("Current remoteStreams array:", this.remoteStreams);
                } else {
                    console.log("Stream already exists in remoteStreams. Skipping addition.");
                }
            } else {
                console.warn("No stream found in the ontrack event.");
            }
        };
    
        // Send ICE candidates to the other peer
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    senderId: this.callerId
                });
            }
        };
    }

    async startCall(): Promise<void> {
        this.createPeerConnection();
    
        // Get the local video/audio stream        
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        this.localStream.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));
    
        // Display the local video
        const localVideo = document.getElementById('local-video') as HTMLVideoElement;
        if (localVideo) {
            localVideo.srcObject = this.localStream!;
            localVideo.play();
        }
    
        // Create offer and send it to the other peer
        const offer = await this.peerConnection!.createOffer();
        await this.peerConnection!.setLocalDescription(offer);
    
        // Log the offer to verify its structure
        console.log("Created offer:", offer);
    
        // Send the offer directly without additional wrapping
        if (offer && offer.type && offer.sdp) {
            this.socket.emit('offer', {
                sdp: offer.sdp,
                type: offer.type,
                channelId: this.channelNumber,
                senderId: this.socket.id,
                senderName: this.currentUser.username
            });
        } else {
            console.error("Failed to create a valid offer:", offer);
        }
    }

    async acceptCall(): Promise<void> {
        this.incomingCall = false;
    
        if (!this.peerConnection) {
            this.createPeerConnection();
        }
    
        if (!this.localStream) {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.localStream.getTracks().forEach(track => this.peerConnection?.addTrack(track, this.localStream));
    
            const localVideo = document.getElementById('local-video') as HTMLVideoElement;
            localVideo.srcObject = this.localStream;
        }
    
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
    
        console.log("Prepared answer to send:", {
            answer: {
                sdp: answer.sdp,
                type: answer.type
            },
            senderId: this.callerId
        });
    
        if (answer && answer.sdp && answer.type) {
            this.socket.emit('answer', {
                answer: {
                    sdp: answer.sdp,
                    type: answer.type
                },
                senderId: this.callerId
            });
        } else {
            console.error("Failed to create a valid answer:", answer);
        }
    }
    
    declineCall(): void {
        this.incomingCall = false;
        this.callerId = '';
        // Optionally send a decline notification to the caller if needed
    }

    muteAudio(): void {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled; // Toggle audio track
            });
        }
    }

    toggleCamera(): void {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled; // Toggle video track
            });
        }
    }
    

    // Mute/unmute remote audio track
    toggleRemoteMute(index: number): void {
        if (this.remoteStreams[index]) {
            this.remoteStreams[index].muted = !this.remoteStreams[index].muted;
            this.remoteStreams[index].stream.getAudioTracks().forEach(track => {
                track.enabled = !this.remoteStreams[index].muted; // Toggle remote audio track
            });
        }
    }

    // Handle file selection
    onFileSelected(event: any): void {
        this.selectedFile = event.target.files[0];
    }

    // Handle image upload form submission
    onImageUpload(event: Event): void {
        event.preventDefault(); // Prevent default form submission

        if (!this.selectedFile) {
            console.error('No file selected');
            return;
        }

        const formData = new FormData();
        formData.append('image', this.selectedFile);
        formData.append('channelId', String(this.channelNumber));
        formData.append('userId', String(this.currentUser.id));
        formData.append('userName', this.currentUser.username);

        // Send POST request to upload the image with `groupId` in the URL
        this.http.post(`${BACKEND_URL}/api/groups/uploadImage/${this.groupNumber}`, formData).subscribe({
            next: (response: any) => {
                if (response.success) {
                    console.log('Image uploaded successfully');
                    this.onSend('image', response.imageUrl); // Use image URL from the response

                    // Clear file input and reset selectedFile
                    const fileInput = document.getElementById('chatImageUpload') as HTMLInputElement;
                    if (fileInput) {
                        fileInput.value = '';
                    }
                    this.selectedFile = null;
                } else {
                    this.showErrorMessage = response.message || 'Failed to upload image';
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Error uploading image: ' + (err.message || 'Unexpected error');
                setTimeout(() => {
                    this.showErrorMessage = '';
                }, 2000);
            },
            complete: () => {
                setTimeout(() => {
                    this.showErrorMessage = '';
                }, 2000);
            }
        });
    }

    // Send a message to the server
    onSend(type: string, imageUrl: string = ''): void {
        if (this.messageContent.trim() || imageUrl.trim()) {
            const messageData = {
                groupId: this.groupNumber,
                channelId: this.channelNumber,
                userId: this.currentUser.id,
                userName: this.currentUser.username,
                messageType: type,
                message: type === 'image' ? imageUrl : this.messageContent,
                avatar: this.currentUser.avatar
            };

            // Send message via socket
            this.socket.emit('message', messageData);

            // Observer to handle response from the backend for persisting the message
            const saveMessageObserver = {
                next: (response: any) => {
                    if (response.success) {
                        console.log('Message saved to channel');
                    } else {
                        this.showErrorMessage = response.message || 'Failed to save message';
                    }
                },
                error: (err: any) => {
                    this.showErrorMessage = 'Error saving message: ' + (err.message || 'Unexpected error');
                    setTimeout(() => {
                        this.showErrorMessage = '';
                    }, 2000);
                },
                complete: () => {
                    setTimeout(() => {
                        this.showErrorMessage = '';
                    }, 2000);
                }
            };

            // Send message to backend to persist in the channel messages array
            this.http.post(`${BACKEND_URL}/api/groups/addMessage`, messageData).subscribe(saveMessageObserver);

            // Clear input field
            this.messageContent = '';
        }
    }

    getAvatarUrl(avatarUrl: string): string {
        return `${environment.BACKEND_URL}/api/users/avatar?path=${avatarUrl}`;
    }

    getImageUrl(imageUrl: string): string {
        return `${BACKEND_URL}/api/groups/group-image?path=${imageUrl}`;
    }

    fetchStoredMessages(groupId: number, channelId: number): void {
        const fetchMessagesObserver = {
            next: (response: any) => {
                if (response.success && response.messages) {
                    this.messages = response.messages;  // Populate the messages array
                }
            },
            error: (err: any) => {
                console.error('Error fetching messages:', err);
            }
        };
    
        this.http.get<{ success: boolean, messages: { channelId: number; userId: number; userName: String; message: string; avatar: string }[] }>(
            `${BACKEND_URL}/api/groups/getMessages?groupId=${groupId}&channelId=${channelId}`
        ).subscribe(fetchMessagesObserver);
    }
    

    // Method to check if the current user is the creator of the channel
    isChannelCreator(): boolean {
        return this.channel && this.currentUser && this.channel.creator.username === this.currentUser.username;
    }

    // Method to navigate back to the group page
    goBackToGroup(): void {
        this.router.navigate(['/view-group'], { queryParams: { groupNumber: this.groupNumber } });
    }

    // Method to leave the current group
    leaveGroup(groupId: number, channelId: number): void {
        const leaveGroupData = {
            groupId: groupId,
            channelId: channelId,
            currentUser: this.currentUser
        };

        const leaveGroupObserver = {
            next: (data: any) => {
                if (data.success) {
                    // Disconnect from the socket after leaving the group
                    if (this.socket) {
                        this.socket.disconnect();
                    }

                    // Remove the user from the local admins and members lists after a successful response
                    this.channel.admins = this.channel.admins.filter((admin: any) => admin.username !== this.currentUser.username);
                    this.channel.members = this.channel.members.filter((member: any) => member.username !== this.currentUser.username);

                    // Navigate back to the group page after leaving the group
                    this.goBackToGroup();
                } else {
                    this.showErrorMessage = data.message;  // Show error message if operation fails
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to leave group';  // Show error if leaving the group fails
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                }, 2000);
            }
        };

        // Send the leave group request to the backend API
        this.http.post(`${BACKEND_URL}/api/groups/leaveChannel`, leaveGroupData).subscribe(leaveGroupObserver);
    }

    // Method to report a user
    reportUser(userId: number): void {
        // Provide a default reason if the input field is empty
        if (!this.reportUserReason.trim()) {
            this.reportUserReason = 'No Reason Provided';
        }

        const reportData = {
            userId: userId,
            reason: this.reportUserReason
        };

        const reportObserver = {
            next: (data: any) => {
                if (data.success) {
                    this.showSuccessMessage = data.message;  // Display success message on successful report
                    this.showReportInput[userId] = false;  // Hide the report input for the user
                } else {
                    this.showErrorMessage = data.message;    // Show error message if the report fails
                }
            },
            error: (err: any) => {
                this.showErrorMessage = 'Failed to report user';  // Handle error during report
            },
            complete: () => {
                setTimeout(() => {
                    this.showSuccessMessage = '';
                    this.showErrorMessage = '';
                    this.reportUserReason = '';  // Clear the report reason input field
                }, 2000);
            }
        };

        // Send the report request to the backend API
        this.http.post(`${BACKEND_URL}/api/users/reportUser`, reportData).subscribe(reportObserver);
    }

    // Method to toggle the report input visibility for a specific user
    toggleReportInput(userId: number): void {
        this.showReportInput[userId] = !this.showReportInput[userId];  // Toggle visibility of the report input
    }

    // Method to cancel the reporting action
    cancelReport(userId: number): void {
        this.showReportInput[userId] = false;  // Hide the report input for the user
        this.reportUserReason = '';            // Clear the report reason input field
    }
}