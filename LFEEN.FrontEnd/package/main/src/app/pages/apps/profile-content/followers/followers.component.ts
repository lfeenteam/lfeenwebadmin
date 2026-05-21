import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconModule } from 'src/app/icon/icon.module';
import { MaterialModule } from 'src/app/material.module';




interface followercards {
  id: number;
  imgSrc: string;
  title: string;
  subtext: string;
  status:boolean;
}
@Component({
  selector: 'app-followers',
  imports: [MaterialModule,IconModule,CommonModule, FormsModule],
  templateUrl: './followers.component.html',
})
export class FollowersComponent implements OnInit{
 
  followercards: followercards[] = [ 
    { id: 1, imgSrc: 'assets/images/profile/user-1.jpg', title: 'Andrew Grant', subtext: 'El Salvador', status: true },
    { id: 2, imgSrc: 'assets/images/profile/user-2.jpg', title: 'Leo Pratt', subtext: 'Bulgaria', status: true },
    { id: 3, imgSrc: 'assets/images/profile/user-3.jpg', title: 'Charles Nunez', subtext: 'Nepal', status: true },
    { id: 4, imgSrc: 'assets/images/profile/user-4.jpg', title: 'Andy G. Emerson', subtext: 'Honduras', status: false },
    { id: 5, imgSrc: 'assets/images/profile/user-5.jpg', title: 'Leonard Pratt', subtext: 'Romania', status: true },
    { id: 6, imgSrc: 'assets/images/profile/user-6.jpg', title: 'C. A. Nunez', subtext: 'Bhutan', status: true },
    { id: 7, imgSrc: 'assets/images/profile/user-7.jpg', title: 'Andrew G. Riley', subtext: 'Guatemala', status: false },
    { id: 8, imgSrc: 'assets/images/profile/user-8.jpg', title: 'L. P. Walters', subtext: 'Slovenia', status: true },
    { id: 9, imgSrc: 'assets/images/profile/user-9.jpg', title: 'Charlie Nunez', subtext: 'Tibet', status: true },
    { id: 10, imgSrc: 'assets/images/profile/user-10.jpg', title: 'A. Granton', subtext: 'Nicaragua', status: false },
    { id: 11, imgSrc: 'assets/images/profile/user-1.jpg', title: 'Grant Andrews', subtext: 'Costa Rica', status: true },
    { id: 12, imgSrc: 'assets/images/profile/user-2.jpg', title: 'Leo Maxwell', subtext: 'Serbia', status: false },
    { id: 13, imgSrc: 'assets/images/profile/user-3.jpg', title: 'C. Nunez Jr.', subtext: 'Lumbini', status: true },
    { id: 14, imgSrc: 'assets/images/profile/user-4.jpg', title: 'Andres G. Vidal', subtext: 'Panama', status: true },
    { id: 15, imgSrc: 'assets/images/profile/user-5.jpg', title: 'L. P. Carter', subtext: 'Croatia', status: false },
    { id: 16, imgSrc: 'assets/images/profile/user-6.jpg', title: 'Nunez Charles', subtext: 'Kathmandu', status: true },
    { id: 17, imgSrc: 'assets/images/profile/user-7.jpg', title: 'Andrew G.', subtext: 'Belize', status: true },
    { id: 18, imgSrc: 'assets/images/profile/user-8.jpg', title: 'Leo P.', subtext: 'Macedonia', status: false },
    { id: 19, imgSrc: 'assets/images/profile/user-9.jpg', title: 'Charles N.', subtext: 'Pokhara', status: true },
    { id: 20, imgSrc: 'assets/images/profile/user-10.jpg', title: 'Leon P. Travis', subtext: 'Bosnia & Herzegovina', status: true }
  ];
  
  searchText: string = '';
  filteredCount: number = 0;
  ngOnInit() {
    this.filteredFollowercards();
   
  }
  filteredFollowercards() {
    let result = this.followercards;
    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      result = this.followercards.filter(card =>
        card.title.toLowerCase().includes(searchLower) ||
        card.subtext.toLowerCase().includes(searchLower)
      );
    }
    this.filteredCount = result.length;  // ✅ update the count
    return result;
  }
}
