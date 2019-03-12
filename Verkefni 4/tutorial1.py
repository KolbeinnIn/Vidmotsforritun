import cv2
import numpy as np

cap = cv2.VideoCapture(0)
while cap.isOpened():
    ret, img = cap.read()

    #cv2.rectangle(img, (350, 400), (638, 100), (0, 255, 0), 0)
    cv2.rectangle(img, (260, 300), (400, 170), (0, 255, 0), 0)
    #crop_image = img[100:400, 350:638]
    crop_image = img[170:300, 260:400]

    gray = cv2.cvtColor(crop_image, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    ret, thresh1 = cv2.threshold(blur, 70, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    contours, hierarchy = cv2.findContours(thresh1, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    drawing = np.zeros(crop_image.shape, np.uint8)

    max_area = 0
    ci = 0
    for i in range(len(contours)):
        cnt = contours[i]
        area = cv2.contourArea(cnt)
        if (area > max_area):
            max_area = area
            ci = i
    cnt = contours[ci]
    hull = cv2.convexHull(cnt)
    moments = cv2.moments(cnt)
    cx, cy = 0, 0
    if moments['m00'] != 0:
        cx = int(moments['m10'] / moments['m00'])  # cx = M10/M00
        cy = int(moments['m01'] / moments['m00'])  # cy = M01/M00

    centr = (cx, cy)
    cv2.circle(crop_image, centr, 5, [0, 0, 255], 2)
    cv2.drawContours(drawing, [cnt], 0, (0, 255, 0), 2)
    cv2.drawContours(drawing, [hull], 0, (0, 0, 255), 2)

    cnt = cv2.approxPolyDP(cnt, 0.01 * cv2.arcLength(cnt, True), True)
    hull = cv2.convexHull(cnt, returnPoints=False)

    if 1:
        defects = cv2.convexityDefects(cnt, hull)
        mind = 0
        maxd = 0
        try:
            for i in range(defects.shape[0]):
                s, e, f, d = defects[i, 0]
                start = tuple(cnt[s][0])
                end = tuple(cnt[e][0])
                far = tuple(cnt[f][0])
                dist = cv2.pointPolygonTest(cnt, centr, True)
                cv2.line(crop_image, start, end, [0, 255, 0], 2)

                cv2.circle(crop_image, far, 5, [0, 0, 255], -1)
        except:
            pass
        #print(i)
        i = 0
    cv2.imshow('output', drawing)
    cv2.imshow('input', img)

    k = cv2.waitKey(10)
    if k == 27:
        break
