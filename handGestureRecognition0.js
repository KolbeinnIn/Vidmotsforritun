try{
	var sphero = require("sphero"), //hér "búum við til" sphero-inn
	orb = sphero("c5:a7:da:16:07:de"); //hér tengjum við hann við tölvuna, þessi parameter er bluetooth addressið hans
	orb.connect(function(){ //orb.connect fallið fer utan um allan image recognition kóðann svo við getum stjórnað sphero hvar sem er í kóðanum
        orb.color("red");
        const cv = require('../');
        const { grabFrames } = require('./utils');

        //ATH! orðið contour er notað mikið í eftirfarandi comments, það þýðir gera augljósan mun á milli lita, blár verður blárri og grænn verður grænni, ekkert á milli. þetta ákvarðar hvað myndavélin pikkar upp og hvað ekki
        // segmenting by skin color (has to be adjusted)
        const skinColorUpper = hue => new cv.Vec(hue, 0.8 * 255, 0.6 * 255); //hápunktur litanna sem húðin okkar er (miðað við color-space-ið BGR2HLS).
        const skinColorLower = hue => new cv.Vec(hue, 0.1 * 255, 0.05 * 255); //lágpunktur litanna sem húðin okkar er (miðað við color-space-ið BGR2HLS).

        const makeHandMask = (img) => {
          // filter by skin color
          const imgHLS = img.cvtColor(cv.COLOR_BGR2HLS);
          const rangeMask = imgHLS.inRange(skinColorLower(0), skinColorUpper(15)); //rangeMask finnur alla pixlanna sem passa á milli hápunkts og lágpunkts litanna, sjá efra comment

          // remove noise
          const blurred = rangeMask.blur(new cv.Size(10, 10)); //hér blurrast myndin aðeins þannig að hún sé meira smooth fyrir thresholdið
          const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY); //thresholdið

          return thresholded;
        };

        const getHandContour = (handMask) => {
          const mode = cv.RETR_EXTERNAL;
          const method = cv.CHAIN_APPROX_SIMPLE;
          const contours = handMask.findContours(mode, method);
          // returnar stærsta contourinu
          return contours.sort((c0, c1) => c1.area - c0.area)[0];
        };

        // returns distance of two points
        //hér returnast bilið á milli tveggja punkta
        const ptDist = (pt1, pt2) => pt1.sub(pt2).norm();

        // hér er miðjan á þeim tveimur punktum
        const getCenterPt = pts => pts.reduce(
            (sum, pt) => sum.add(pt),
            new cv.Point(0, 0)
          ).div(pts.length);

        // þetta er of gott comment til að þýða↓↓↓↓↓
        // get the polygon from a contours hull such that there
        // will be only a single hull point for a local neighborhood
        const getRoughHull = (contour, maxDist) => {
          // get hull indices and hull points
          const hullIndices = contour.convexHullIndices();
          const contourPoints = contour.getPoints();
          const hullPointsWithIdx = hullIndices.map(idx => ({
            pt: contourPoints[idx],
            contourIdx: idx
          }));
          const hullPoints = hullPointsWithIdx.map(ptWithIdx => ptWithIdx.pt);

          // group all points in local neighborhood
          const ptsBelongToSameCluster = (pt1, pt2) => ptDist(pt1, pt2) < maxDist;
          const { labels } = cv.partition(hullPoints, ptsBelongToSameCluster);
          const pointsByLabel = new Map();
          labels.forEach(l => pointsByLabel.set(l, []));
          hullPointsWithIdx.forEach((ptWithIdx, i) => {
            const label = labels[i];
            pointsByLabel.get(label).push(ptWithIdx);
          });

          // map points in local neighborhood to most central point
          const getMostCentralPoint = (pointGroup) => {
            // finna miðju
            const center = getCenterPt(pointGroup.map(ptWithIdx => ptWithIdx.pt));
            // sort ascending by distance to center
            return pointGroup.sort(
              (ptWithIdx1, ptWithIdx2) => ptDist(ptWithIdx1.pt, center) - ptDist(ptWithIdx2.pt, center)
            )[0];
          };
          const pointGroups = Array.from(pointsByLabel.values());
          // return contour indeces of most central points
          return pointGroups.map(getMostCentralPoint).map(ptWithIdx => ptWithIdx.contourIdx);
        };

        const getHullDefectVertices = (handContour, hullIndices) => {
          const defects = handContour.convexityDefects(hullIndices);
          const handContourPoints = handContour.getPoints();

          // get neighbor defect points of each hull point
          const hullPointDefectNeighbors = new Map(hullIndices.map(idx => [idx, []]));
          defects.forEach((defect) => {
            const startPointIdx = defect.at(0);
            const endPointIdx = defect.at(1);
            const defectPointIdx = defect.at(2);
            hullPointDefectNeighbors.get(startPointIdx).push(defectPointIdx);
            hullPointDefectNeighbors.get(endPointIdx).push(defectPointIdx);
          });

          return Array.from(hullPointDefectNeighbors.keys())
            // only consider hull points that have 2 neighbor defects
            .filter(hullIndex => hullPointDefectNeighbors.get(hullIndex).length > 1)
            // return vertex points
            .map((hullIndex) => {
              const defectNeighborsIdx = hullPointDefectNeighbors.get(hullIndex);
              return ({
                pt: handContourPoints[hullIndex],
                d1: handContourPoints[defectNeighborsIdx[0]],
                d2: handContourPoints[defectNeighborsIdx[1]]
              });
            });
        };

        const filterVerticesByAngle = (vertices, maxAngleDeg) =>
          vertices.filter((v) => {
            const sq = x => x * x;
            const a = v.d1.sub(v.d2).norm();
            const b = v.pt.sub(v.d1).norm();
            const c = v.pt.sub(v.d2).norm();
            const angleDeg = Math.acos(((sq(b) + sq(c)) - sq(a)) / (2 * b * c)) * (180 / Math.PI);
            return angleDeg < maxAngleDeg;
          });

        const blue = new cv.Vec(255, 0, 0); //blár
        const green = new cv.Vec(0, 255, 0); //grænn
        const red = new cv.Vec(0, 0, 255); //rauður

        // main-ið
        const delay = 20;
        //í grabFrames er hægt að skipta 0 út fyrir path á myndband, 0 segir forritinu að nota default-myndavél.
        grabFrames(0, delay, (frame) => {
          const resizedImg = frame.resizeToMax(360); //minnkum myndina niður í 360 pixla þannig það tekur ekki upp allan skjáinn, default er 1080

          const handMask = makeHandMask(resizedImg); //hér köllum við á makeHandMask, það fall er efst
          const handContour = getHandContour(handMask); //hér contourum við handMaskið sem við vorum að fá
          if (!handContour) {
            return;
          }

          const maxPointDist = 25;
          const hullIndices = getRoughHull(handContour, maxPointDist);

          // get defect points of hull to contour and return vertices
          // of each hull point to its defect points
          const vertices = getHullDefectVertices(handContour, hullIndices);

          // fingertip points are those which have a sharp angle to its defect points
          const maxAngleDeg = 60;
          const verticesWithValidAngle = filterVerticesByAngle(vertices, maxAngleDeg);

          const result = resizedImg.copy();
          // draw bounding box and center line
          resizedImg.drawContours(
            [handContour],
            blue,
            { thickness: 2 }
          );

          // hér teiknum við línur og punkta
          verticesWithValidAngle.forEach((v) => {
            resizedImg.drawLine(
              v.pt,
              v.d1,
              { color: green, thickness: 2 }
            );
            resizedImg.drawLine(
              v.pt,
              v.d2,
              { color: green, thickness: 2 }
            );
            resizedImg.drawEllipse(
              new cv.RotatedRect(v.pt, new cv.Size(20, 20), 0),
              { color: red, thickness: 2 }
            );
            result.drawEllipse(
              new cv.RotatedRect(v.pt, new cv.Size(20, 20), 0),
              { color: red, thickness: 2 }
            );
          });

          // hér er loka útkoman um hversu marga putta notandi hefur uppi
          const numFingersUp = verticesWithValidAngle.length;
          result.drawRectangle(
            new cv.Point(10, 10),
            new cv.Point(70, 70),
            { color: green, thickness: 2 }
          );
          //hér finnum við hversu margir puttar eru uppi og rúllum sphero í viðeigandi átt (meira um það í skýrslunni)
              if(numFingersUp >= 5){
                  //orb.roll(speed,degrees)
                  orb.roll(0,0);
              }
              if(numFingersUp == 4){ //afram
                  orb.roll(60,0);
              }
              if(numFingersUp == 3){ //hægri
                  orb.roll(60,90);
              }
              if(numFingersUp == 2){ //vinstri
                  orb.roll(60,270);
              }
              if(numFingersUp == 1){ //afturbaka
                  orb.roll(60,180);
              }

          const fontScale = 2;
          result.putText(
            String(numFingersUp),
            new cv.Point(20, 60),
            cv.FONT_ITALIC,
            fontScale,
            { color: green, thickness: 2 }
          );

          const { rows, cols } = result;
          const sideBySide = new cv.Mat(rows, cols * 2, cv.CV_8UC3);
          result.copyTo(sideBySide.getRegion(new cv.Rect(0, 0, cols, rows)));
          resizedImg.copyTo(sideBySide.getRegion(new cv.Rect(cols, 0, cols, rows)));

          cv.imshow('handMask', handMask); //hér er live feed af maskinu
          cv.imshow('result', sideBySide); //hér er live feed úr myndavélinni með línum á milli fingurgómanna og það sem er í rauðu hringjunum, veit ekki hvað þetta heitir (sjá mynd á þessum link https://github.com/KolbeinnIn/Vidmotsforritun/blob/master/thingi%C3%B0%20%C3%A1%20botninum%20%C3%A1%20milli%20putta.png)
        });
    })
}
catch(err){ //ignorum alla errors af því að þá frýs forritið og myndavélin, þetta virkar vel svona
	console.log(); // það þurfti að vera eitthvað inni í catch-inu
}