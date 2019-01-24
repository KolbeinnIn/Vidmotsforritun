let s = Snap("#texti");
let text = 'Sicc logo -allir 2019';

let textArray = text.split(" ");
let len = textArray.length;
let timing = 750;
function rand(min, max) 
{
    return Math.random() * (max-min) + min ;
}

function sicc(){
    for(let index=0; index < len; index++ ) {
        let svgTextElement = s.text(480,350, textArray[index]).attr({ fontSize: '120px', opacity: 0, "text-anchor": "middle"});
        setTimeout( function() {
            let random = rand(10,100);
                Snap.animate(0, 1, function( value ) {
                    svgTextElement.attr({ 'font-size': value * random,  opacity: value });
                }, timing, mina.bounce, function() { svgTextElement.remove() } );
                            }
        ,index * timing)
    }
}
sicc();
setInterval(sicc, 3000);
//bøåt.addEventListener( 'mouseover', sicc);

