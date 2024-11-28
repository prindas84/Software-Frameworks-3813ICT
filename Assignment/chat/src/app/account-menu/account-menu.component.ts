// Angular core modules
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// Services
import { AuthoriseService } from '../services/authorise.service';

@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],  // Import CommonModule and RouterModule for use within this component
  templateUrl: './account-menu.component.html',
  styleUrl: './account-menu.component.css'
})
export class AccountMenuComponent implements OnInit {
  
  // Boolean to track if the user is a super-admin
  isSuperAdmin: boolean = false;

  constructor(private authService: AuthoriseService) { }

  ngOnInit(): void {
    // Check if the user is a super-admin by retrieving the user from the AuthService
    const user = this.authService.getUser();
    this.isSuperAdmin = user.permission === 'super-admin';
  }
}
