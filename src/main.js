import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });

// долгое нажатие ничего не выделяет и не открывает системное меню
document.addEventListener('contextmenu', (e) => e.preventDefault());
