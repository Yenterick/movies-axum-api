import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './login/login';
import { Admin } from './admin/admin';
import { About } from './about/about';

export const routes: Routes = [
    {path: '', component: Home, title: 'CineData · Movies API'},
    {path: 'login', component: Login, title: 'Iniciar sesión · CineData'},
    {path: 'gestion', component: Admin, title: 'Gestión del catálogo · CineData'},
    {path: 'sobre-nosotros', component: About, title: 'Sobre nosotros · CineData'},
    {path: '**', redirectTo: ''}
];
