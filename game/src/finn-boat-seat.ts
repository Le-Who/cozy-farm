/** Composite the used boat and Finn's existing idle frame. Repainting its near rail
 * hides the lower body, so a passenger sits inside rather than standing on the hull. */
export function finnBoatSeat(boat:HTMLImageElement,finn:HTMLImageElement,make=()=>document.createElement('canvas')) {
  const seat=make();seat.width=160;seat.height=132
  const g=seat.getContext('2d');if(!g)return
  const y=45
  g.drawImage(boat,0,y,160,87)
  const cell=finn.naturalHeight
  g.drawImage(finn,0,0,cell,cell,32,27,102,102)
  g.save();g.beginPath();g.moveTo(0,y+26);g.lineTo(21,y+37);g.lineTo(49,y+47)
  g.lineTo(78,y+50);g.lineTo(108,y+49);g.lineTo(135,y+43);g.lineTo(160,y+33)
  g.lineTo(160,132);g.lineTo(0,132);g.closePath();g.clip();g.drawImage(boat,0,y,160,87);g.restore()
  return seat
}
