import './sass/mystyles.scss';

import Linkagram from './scenes/Linkagram';

const parseConfig = () => {
    const parameters = new URLSearchParams(window.location.search);
    return {
        size: {
            width: parseInt(parameters.get('width') || "4", 10),
            height: parseInt(parameters.get('height') || "4", 10)
        },
        id: parseInt(parameters.get('id') || `${Math.random() * 10000}`, 10)
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // start running game
    new Linkagram(parseConfig()).run();
});
