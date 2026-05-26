import p5 from 'p5';

export const contactSketch = (p: any) => {
  let angle = 0;
  let blips: { x: number, y: number, alpha: number, maxRadius: number }[] = [];
  
  const THEME = {
    dark: '#0D0D0E',
    magenta: '#FF0055',
    gray: '#D4D6DC',
  };

  p.setup = () => {
    p.createCanvas(10, 10);
    if (p.canvas && p.canvas.parentElement) {
      p.resizeCanvas(p.canvas.parentElement.clientWidth, p.canvas.parentElement.clientHeight);
    } else {
      p.resizeCanvas(p.windowWidth, 300);
    }
  };

  p.draw = () => {
    p.clear(0, 0, 0, 0);
    p.translate(p.width / 2, p.height / 2);

    let isMouseActive = p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height;

    // Draw grid rings
    p.noFill();
    p.stroke(THEME.gray);
    p.strokeWeight(1);
    for (let r = 50; r <= p.width; r += 100) {
      p.circle(0, 0, r);
    }
    p.line(-p.width/2, 0, p.width/2, 0);
    p.line(0, -p.height/2, 0, p.height/2);

    // Radar Sweeper
    angle += isMouseActive ? p.map(p.dist(p.mouseX, p.mouseY, p.width/2, p.height/2), 0, p.width/2, 0.1, 0.02) : 0.02;
    let dx = p.cos(angle) * (p.width);
    let dy = p.sin(angle) * (p.width);
    
    p.stroke(THEME.magenta);
    p.strokeWeight(2);
    p.line(0, 0, dx, dy);
    
    // Draw sweeping arc gradient
    p.noStroke();
    p.fill(THEME.magenta + '20'); // tiny bit of alpha
    p.arc(0, 0, p.width*2, p.width*2, angle - 0.5, angle);

    // Occasional random blips
    if (p.frameCount % 60 === 0 && p.random() > 0.5) {
      blips.push({
        x: p.random(-p.width/3, p.width/3),
        y: p.random(-p.height/3, p.height/3),
        alpha: 255, maxRadius: p.random(20, 60)
      });
    }

    // Add blip on cursor if it's moving fast
    let velocity = p.dist(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY);
    if (isMouseActive && velocity > 10 && p.frameCount % 5 === 0) {
      blips.push({
        x: p.mouseX - p.width/2,
        y: p.mouseY - p.height/2,
        alpha: 255, maxRadius: velocity * 2
      });
    }

    // Draw and fade blips
    for (let i = blips.length - 1; i >= 0; i--) {
      let b = blips[i];
      p.noFill();
      p.stroke(THEME.magenta + p.hex(p.floor(b.alpha), 2));
      p.strokeWeight(3);
      let r = p.map(b.alpha, 255, 0, 10, b.maxRadius);
      p.circle(b.x, b.y, r);
      
      p.fill(THEME.dark + p.hex(p.floor(b.alpha), 2));
      p.noStroke();
      p.circle(b.x, b.y, 8);

      b.alpha -= 5;
      if (b.alpha <= 0) {
        blips.splice(i, 1);
      }
    }
  };

  p.windowResized = () => {
    if (p.canvas && p.canvas.parentElement) {
      p.resizeCanvas(p.canvas.parentElement.clientWidth, p.canvas.parentElement.clientHeight);
    } else {
      p.resizeCanvas(p.windowWidth, 300);
    }
  };
};
