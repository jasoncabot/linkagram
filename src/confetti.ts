const randBetween = (min: number, max: number) => Math.random() * (max - min) + min;

const confettiParams = {
    // number of confetti per "explosion"
    number: 70,
    // min and max size for each rectangle
    size: { x: [5, 20], y: [10, 18] },
    // power of explosion
    initSpeed: 25,
    // defines how fast particles go down after blast-off
    gravity: 0.65,
    // how wide is explosion
    drag: 0.08,
    // how slow particles are falling
    terminalVelocity: 6,
    // how fast particles are rotating around themselves
    flipSpeed: 0.017,
};
const colors = [
    { front: '#3B870A', back: '#235106' },
    { front: '#B96300', back: '#6f3b00' },
    { front: '#E23D34', back: '#88251f' },
    { front: '#CD3168', back: '#7b1d3e' },
    { front: '#664E8B', back: '#3d2f53' },
    { front: '#394F78', back: '#222f48' },
    { front: '#008A8A', back: '#005353' },
];


// Confetti constructor
class Conf {
    randomModifier: number;
    colorPair: { front: string; back: string; };
    dimensions: { x: number; y: number; };
    position: { x: number; y: number; };
    rotation: number;
    scale: { x: number; y: number; };
    velocity: { x: number; y: number; };
    flipSpeed: number;
    terminalVelocity: number;
    color: string;

    constructor(x: number, y: number, containerHeight: number) {
        this.randomModifier = randBetween(-1, 1);
        this.colorPair = colors[Math.floor(randBetween(0, colors.length))];
        this.color = this.colorPair.front;
        this.dimensions = {
            x: randBetween(confettiParams.size.x[0], confettiParams.size.x[1]),
            y: randBetween(confettiParams.size.y[0], confettiParams.size.y[1]),
        };
        this.position = { x, y };
        this.rotation = randBetween(0, 2 * Math.PI);
        this.scale = { x: 1, y: 1 };
        this.velocity = {
            x: randBetween(-confettiParams.initSpeed, confettiParams.initSpeed) * 0.4,
            y: randBetween(-confettiParams.initSpeed, confettiParams.initSpeed)
        };
        this.flipSpeed = randBetween(0.2, 1.5) * confettiParams.flipSpeed;

        if (this.position.y <= containerHeight) {
            this.velocity.y = -Math.abs(this.velocity.y);
        }

        this.terminalVelocity = randBetween(1, 1.5) * confettiParams.terminalVelocity;
    }


    update() {
        this.velocity.x *= 0.98;
        this.position.x += this.velocity.x;

        this.velocity.y += (this.randomModifier * confettiParams.drag);
        this.velocity.y += confettiParams.gravity;
        this.velocity.y = Math.min(this.velocity.y, this.terminalVelocity);
        this.position.y += this.velocity.y;

        this.scale.y = Math.cos((this.position.y + this.randomModifier) * this.flipSpeed);
        this.color = this.scale.y > 0 ? this.colorPair.front : this.colorPair.back;
    }
}

const confettiElements: Conf[] = [];
let animationFrameHandle: number;

const updateConfetti = (context: CanvasRenderingContext2D, width: number, height: number) => {
    context.clearRect(0, 0, width, height);

    confettiElements.forEach((c) => {
        c.update();
        context.translate(c.position.x, c.position.y);
        context.rotate(c.rotation);
        const width = (c.dimensions.x * c.scale.x);
        const height = (c.dimensions.y * c.scale.y);
        context.fillStyle = c.color;
        context.fillRect(-0.5 * width, -0.5 * height, width, height);
        context.setTransform(1, 0, 0, 1, 0, 0)
    });

    confettiElements.forEach((c, idx) => {
        if (c.position.y > height ||
            c.position.x < -0.5 * width ||
            c.position.x > 1.5 * width) {
            confettiElements.splice(idx, 1);
        }
    });

    animationFrameHandle = window.requestAnimationFrame(() => {
        updateConfetti(context, width, height);
    })
}

const addConfetti = (area: DOMRect) => {
    for (let i = 0; i < confettiParams.number; i++) {
        confettiElements.push(new Conf(
            area.width * Math.random(),
            area.height * Math.random(),
            area.height
        ));
    }
}

export const celebrate = (onEnded: () => void) => {
    const confetti = document.getElementById('celebration') as HTMLCanvasElement;
    confetti.style.display = "block";
    confetti.width = confetti.clientWidth;
    confetti.height = confetti.clientHeight;

    const confettiCtx = confetti?.getContext('2d')!;

    updateConfetti(confettiCtx, confetti.width, confetti.height);

    let celebrating = true;

    // 5 seconds of fun
    setTimeout(() => {
        celebrating = false;
    }, 5000);

    const canvasBox = confetti.getBoundingClientRect();
    const addExplosion = () => {
        // queue up some more fun - or just end it all now
        if (celebrating) {
            addConfetti(canvasBox);
            setTimeout(addExplosion, 700 + Math.random() * 1700);
        } else {
            endCelebration();
        }
    }

    const endCelebration = () => {
        confettiElements.splice(0, confettiElements.length);
        window.cancelAnimationFrame(animationFrameHandle);
        confetti.style.display = "none";
        onEnded();
    }

    addExplosion();
}
