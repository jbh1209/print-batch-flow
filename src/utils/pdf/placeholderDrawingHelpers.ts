
import { rgb } from "pdf-lib";

// Draw an empty placeholder when there's no job
export function drawEmptyPlaceholder(
  page: any, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  font: any
) {
  // Draw empty placeholder with lighter border
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
    color: rgb(0.97, 0.97, 0.97)
  });
  
  // Draw text indicating empty
  page.drawText("Empty", {
    x: x + width / 2 - 15,
    y: y + height / 2,
    size: 12,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });
}
