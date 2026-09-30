

// 1. Define Coordinate System


proj4.defs(
    "EPSG:32636",
    "+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs"
);



// 2. Create Map


const map = L.map("map").setView(
    [24.0889, 32.8998],
    13
);



// 3. Google Satellite


const googleSatellite = L.tileLayer(
    "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
        attribution: "&copy; Google"
    }
).addTo(map);



// 4. Convert Coordinates
// EPSG:32636 -> EPSG:4326


function convertCoordinates(coords) {

    // Single coordinate [X, Y]
    if (
        typeof coords[0] === "number" &&
        typeof coords[1] === "number"
    ) {

        const result = proj4(
            "EPSG:32636",
            "EPSG:4326",
            coords
        );

        return [
            result[0],
            result[1]
        ];
    }

    // Nested coordinates
    return coords.map(convertCoordinates);
}


// 5. Convert GeoJSON

function convertGeoJSON(data) {

    return {
        ...data,

        features: data.features.map(feature => {

            if (!feature.geometry) {
                return feature;
            }

            return {
                ...feature,

                geometry: {
                    ...feature.geometry,

                    coordinates:
                        convertCoordinates(
                            feature.geometry.coordinates
                        )
                }
            };
        })
    };
}


// 6. Layer Containers

const roadLayers = {};
const pointLayers = {};
const rrLayers = {};


// 7. Billboard Icon

const billboardIcon = L.icon({

    iconUrl: "billboard-svgrepo-com.svg",

    iconSize: [35, 35],

    iconAnchor: [17, 35],

    popupAnchor: [0, -35]
});


// 8. Road Styles
const roadStyles = {

    "M Road": {
        color: "#555",
        weight: 8,
        opacity: 0.9
    },

    "Main Road": {
        color: "#333",
        weight: 10,
        opacity: 0.95
    }
};


// 9. Load Road Layer

function loadRoadLayer(fileName, layerName) {

    return fetch(fileName)
        .then(response => response.json())
        .then(data => {

            const convertedData =
                convertGeoJSON(data);

            const layer = L.geoJSON(
                convertedData,
                {
                    style:
                        roadStyles[layerName]
                }
            ).addTo(map);

            roadLayers[layerName] = layer;
        });
}


// 10. Group Features by Group

function groupFeatures(features) {

    const groups = {};

    features.forEach(feature => {

        const group =
            feature.properties?.group || "Other";

        if (!groups[group]) {
            groups[group] = [];
        }

        groups[group].push(feature);
    });

    return groups;
}


// 11. Create Billboard Popup

function createBillboardPopup(
    feature,
    includeID = false
) {

    const p = feature.properties || {};

    let popup = `
        <div dir="rtl">

            <b>Group:</b>
            ${p.group || "-"}
            <br>
    `;

    if (includeID) {

        popup += `
            <b>ID:</b>
            ${p.id || "-"}
            <br>
        `;
    }

    popup += `
            <b>حجم اللوحة:</b>
            ${p.sign_size || "-"}
            <br>

            <b>المسافة:</b>
            ${p.distance || "-"}
            <br>

            <b>الزاوية:</b>
            ${p.angle || "-"}

        </div>
    `;

    return popup;
}


// 12. Create Billboard Layer

function createBillboardLayer(
    features,
    includeID = false
) {

    const groupData = {

        type: "FeatureCollection",

        features: features
    };

    return L.geoJSON(
        groupData,
        {

            pointToLayer:
                (feature, latlng) => {

                    return L.marker(
                        latlng,
                        {
                            icon: billboardIcon
                        }
                    );
                },

            onEachFeature:
                (feature, layer) => {

                    layer.bindPopup(
                        createBillboardPopup(
                            feature,
                            includeID
                        )
                    );
                }
        }
    ).addTo(map);
}


// 13. Load Billboard Groups

function loadBillboardGroups(
    fileName,
    targetObject,
    includeID = false
) {

    return fetch(fileName)
        .then(response => response.json())
        .then(data => {

            const convertedData =
                convertGeoJSON(data);

            const groups =
                groupFeatures(
                    convertedData.features
                );

            Object.keys(groups).forEach(group => {

                targetObject[group] =
                    createBillboardLayer(
                        groups[group],
                        includeID
                    );
            });
        });
}


// 14. Load All Layers

Promise.all([

    // Roads
    loadRoadLayer(
        "M_road.geojson",
        "M Road"
    ),

    loadRoadLayer(
        "mainR.geojson",
        "Main Road"
    ),

    // Main / M / NB / SB
    loadBillboardGroups(
        "points_merged.geojson",
        pointLayers,
        false
    ),

    // rr1 / rr2 / oo
    loadBillboardGroups(
        "R3points.geojson",
        rrLayers,
        true
    )

])
.then(() => {


    // 15. Add All Layers to Layer Control

    const overlays = {

        // Roads
        "M Road":
            roadLayers["M Road"],

        "Main Road":
            roadLayers["Main Road"],


        // Main Billboard Groups
        "لوحات Main":
            pointLayers["Main"],

        "لوحات M":
            pointLayers["M"],

        "لوحات NB":
            pointLayers["NB"],

        "لوحات SB":
            pointLayers["SB"],


        // RR Billboard Groups
        "لوحات rr1":
            rrLayers["rr1"],

        "لوحات rr2":
            rrLayers["rr2"],

        "لوحات oo":
            rrLayers["oo"]
    };


    // 16. Add Layer Control
    // collapsed: true = Show icon only

    L.control.layers(
        {
            "Google Satellite":
                googleSatellite
        },

        overlays,

        {
            collapsed: true
        }

    ).addTo(map);

});