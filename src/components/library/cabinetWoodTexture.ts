// A local, low-contrast SVG grain. No remote material or raster dependency is needed.
const grain = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="440" viewBox="0 0 800 440">
  <defs>
    <pattern id="grain" width="400" height="64" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="#26160c" stroke-opacity=".13" stroke-width=".6">
        <path d="M-20 8C70 3 91 14 170 10S300 4 420 8M-20 14C65 9 105 18 181 15S320 11 420 14"/>
        <path d="M-20 28C81 29 110 20 202 25S331 32 420 28M-20 34C74 35 121 27 207 31S337 39 420 34"/>
        <path d="M-20 49C85 44 139 54 219 50S337 45 420 49M-20 56C91 51 126 59 224 56S348 53 420 56"/>
      </g>
      <g fill="none" stroke="#f8d5a0" stroke-opacity=".10" stroke-width=".5">
        <path d="M-20 11C73 6 96 16 175 12S305 7 420 11M-20 32C79 33 115 24 204 29S333 36 420 32"/>
        <path d="M-20 52C88 47 131 56 221 53S343 49 420 52"/>
      </g>
    </pattern>
  </defs>
  <path fill="url(#grain)" d="M0 0h800v440H0z"/>
</svg>`;

export const CABINET_WOOD_TEXTURE_URI = `data:image/svg+xml;utf8,${encodeURIComponent(grain)}`;
