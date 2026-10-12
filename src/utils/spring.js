const STEP = 1 / 240;
const MAX_FRAME = 1 / 15;
const REST_THRESHOLD = 0.01;

const toPhysics = ({ duration, bounce = 0, ...config }) =>
  duration === undefined
    ? config
    : {
        ...config,
        stiffness: ((2 * Math.PI) / duration) ** 2,
        damping: ((1 - bounce) * 4 * Math.PI) / duration,
      };

export function createSpring(element, props, render) {
  const springs = Object.fromEntries(
    Object.entries(props).map(([name, config]) => {
      const {
        position,
        target = position,
        velocity = 0,
        stiffness,
        damping,
      } = toPhysics(config);

      return [name, { position, target, velocity, stiffness, damping }];
    }),
  );

  let frame = null;
  let previousTime = 0;
  let accumulator = 0;

  const values = () =>
    Object.fromEntries(
      Object.entries(springs).map(([name, spring]) => [name, spring.position]),
    );

  const integrate = (spring) => {
    const acceleration =
      spring.stiffness * (spring.target - spring.position) -
      spring.damping * spring.velocity;

    spring.velocity += acceleration * STEP;
    spring.position += spring.velocity * STEP;
  };

  const tick = (time) => {
    accumulator += Math.min(Math.max(time - previousTime, 0) / 1000, MAX_FRAME);
    previousTime = time;

    while (accumulator >= STEP) {
      Object.values(springs).forEach(integrate);
      accumulator -= STEP;
    }

    let isMoving = false;

    Object.values(springs).forEach((spring) => {
      const isResting =
        Math.abs(spring.target - spring.position) < REST_THRESHOLD &&
        Math.abs(spring.velocity) < REST_THRESHOLD;

      if (isResting) {
        spring.position = spring.target;
        spring.velocity = 0;
      } else {
        isMoving = true;
      }
    });

    render(values(), element);
    frame = isMoving ? requestAnimationFrame(tick) : null;
  };

  const wake = () => {
    if (frame !== null) return;

    previousTime = performance.now();
    accumulator = 0;
    frame = requestAnimationFrame(tick);
  };

  render(values(), element);

  return {
    setTarget(name, value) {
      springs[name].target = value;
      wake();
    },
    snap(name, value) {
      Object.assign(springs[name], {
        position: value,
        target: value,
        velocity: 0,
      });
      render(values(), element);
    },
    get: (name) => springs[name].position,
    destroy() {
      cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
