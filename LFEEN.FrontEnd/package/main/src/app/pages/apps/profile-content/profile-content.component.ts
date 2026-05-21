import { Component } from '@angular/core';

import { ProfileComponent } from './profile/profile.component';
import { FollowersComponent } from './followers/followers.component';
import { FriendsComponent } from './friends/friends.component';
import { GalleryComponent } from './gallery/gallery.component';
import { MaterialModule } from 'src/app/material.module';


import { CommonModule } from '@angular/common';
import { IconModule } from 'src/app/icon/icon.module';
@Component({
  selector: 'app-profile-content',
  imports: [MaterialModule,ProfileComponent,FollowersComponent,FriendsComponent,GalleryComponent,CommonModule,IconModule ],
  templateUrl: './profile-content.component.html',
  styleUrl: './profile-content.component.scss'
})
export class ProfileContentComponent {
  pageTitle = 'UserProfile';
  selectedTab = 0;
}

