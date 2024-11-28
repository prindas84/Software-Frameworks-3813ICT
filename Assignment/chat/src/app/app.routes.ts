import { Routes } from '@angular/router';
import { AccountComponent } from './account/account.component';
import { LoginComponent } from './login/login.component';
import { VideoChatComponent } from './video-chat/video-chat.component';
import { UsersComponent } from './users/users.component';
import { GroupsComponent } from './groups/groups.component';
import { ViewGroupComponent } from './view-group/view-group.component';

export const routes: Routes = [
    {path:'account',component:AccountComponent},
    {path:'login',component:LoginComponent},
    {path:'video-chat',component:VideoChatComponent},
    {path:'users',component:UsersComponent},
    {path:'groups',component:GroupsComponent},
    {path:'view-group',component:ViewGroupComponent},
];
