import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {CreateTournamentPage} from './create-tournament/create-tournament.page';

import {HomePageRoutingModule} from './home-routing.module';
import {HomePage} from './home.page';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
  ],
  declarations: [
    HomePage,
    CreateTournamentPage,
  ]
})
export class HomePageModule {
}
