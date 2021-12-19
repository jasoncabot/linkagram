import './sass/mystyles.scss';

import Linkagram from './scenes/Linkagram';

document.addEventListener('DOMContentLoaded', () => {
    // start running game
    new Linkagram({}).run();
});
