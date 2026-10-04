// A local, low-contrast wood grain with irregular growth lines and a restrained knot.
// The same material is shared by both shelf orientations so the cabinet stays coherent.
const grain = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="440" viewBox="0 0 800 440">
  <defs>
    <pattern id="grain" width="800" height="440" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="#26160c" stroke-opacity=".24" stroke-width=".7">
        <path d="M-20 28C66 17 120 42 212 30S356 17 438 30 602 43 820 22"/>
        <path d="M-20 38C74 26 122 51 218 40S360 28 446 40 624 52 820 32"/>
        <path d="M-20 86C93 72 142 94 254 84S394 75 488 86 665 99 820 77"/>
        <path d="M-20 98C92 84 151 107 260 97S402 88 496 99 662 110 820 89"/>
        <path d="M-20 154C74 145 162 169 257 158S406 144 512 156 669 170 820 148"/>
        <path d="M-20 166C85 156 169 181 266 170S420 157 518 168 684 182 820 160"/>
        <path d="M-20 236C82 219 147 248 248 235S405 222 504 236 676 250 820 229"/>
        <path d="M-20 247C74 231 154 259 253 247S414 234 509 247 680 261 820 240"/>
        <path d="M-20 316C92 305 165 326 273 313S418 304 528 316 680 331 820 307"/>
        <path d="M-20 329C91 317 174 340 281 326S426 317 535 329 694 342 820 320"/>
        <path d="M-20 390C79 377 145 402 249 389S407 377 505 391 673 405 820 382"/>
        <path d="M-20 402C81 390 155 414 257 401S414 389 514 402 686 417 820 394"/>
      </g>
      <g fill="none" stroke="#f8d5a0" stroke-opacity=".18" stroke-width=".55">
        <path d="M-20 33C66 22 124 47 214 35S359 22 441 35 605 48 820 27"/>
        <path d="M-20 91C90 78 145 101 257 90S398 80 491 92 669 105 820 83"/>
        <path d="M-20 160C77 151 163 175 260 164S410 150 515 162 673 176 820 154"/>
        <path d="M-20 241C81 225 150 253 250 241S408 228 506 241 679 255 820 234"/>
        <path d="M-20 322C91 311 170 333 278 319S423 310 532 322 688 336 820 313"/>
        <path d="M-20 396C81 383 151 408 253 395S411 383 510 397 679 411 820 388"/>
      </g>
      <g fill="none" stroke="#26160c" stroke-opacity=".22" stroke-width=".8">
        <path d="M256 205c18-15 49-20 69-8 17 10 18 27 2 37-18 11-49 8-67-3 18-10 37-12 52-6-16 9-34 9-47 2"/>
        <path d="M259 205c20-8 41-9 58-3" stroke="#f8d5a0" stroke-opacity=".10"/>
      </g>
    </pattern>
  </defs>
  <path fill="url(#grain)" d="M0 0h800v440H0z"/>
</svg>`;

export const CABINET_WOOD_TEXTURE_URI = `data:image/svg+xml;utf8,${encodeURIComponent(grain)}`;
