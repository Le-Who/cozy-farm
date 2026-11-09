/** Cream stays on the same spoon between gestures; only contact with the glass
 * transfers it. Quantities are fractions of the finished cream layer. */
export function createParfaitTransfer() {
  let load=0,delivered=0
  const capacity=.34
  return {
    get load(){return load},get delivered(){return delivered},get capacity(){return capacity},
    scoop(){load=capacity},
    finishDeposit(){const amount=Math.min(load,1-delivered);load-=amount;delivered+=amount;return amount},
    step(seconds:number,scooping:boolean,overGlass:boolean){
      if(!Number.isFinite(seconds)||seconds<=0)return 0
      const dt=Math.min(seconds,.05)
      if(scooping)load=Math.min(capacity,load+dt*1.7)
      if(!overGlass||load<=0)return 0
      const amount=Math.min(load,dt*.85,1-delivered)
      load=Math.max(0,load-amount);delivered=Math.min(1,delivered+amount)
      return amount
    },
  }
}
