// minimal RealGalacticLayout stub kept to avoid breaking references
export class RealGalacticLayout {
  public getPosition() {
    return { x: 0, y: 0, z: 0, distFromCenter: 0, velocity: { x: 0, y: 0, z: 0 } };
  }
  public setArms() {}
  public setBulgeRadius() {}
  public setDiskRadius() {}
}
export const galacticLayout = new RealGalacticLayout();
try { (window as any).galacticLayout = galacticLayout; } catch (e) {}
