# Sources: issue #66, whole-Moon heights for the 3D globe

| What | Used for | Link | Licence or terms |
|---|---|---|---|
| LRO LOLA `LDEM_16`, product version V3.1, data set LRO-L-LOLA-4-GDR-V1.0 (created 2019-03-15) | The whole-Moon height grid (`globe.bin`) | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ (`ldem_16.img`, `.lbl`) | NASA PDS data, public domain |
| LRO LOLA `LDEM_75N_240M`, product version V2.1, same data set (created 2016-09-15) | The north cap's height grid (`north.bin`) | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ (`ldem_75n_240m.img`, `.lbl`) | NASA PDS data, public domain |
| The two products' PDS labels | Grid layout: size, scale, datum, projection, longitude range and direction | Same folders | NASA PDS, public domain |
| `dem.bin` (T04, LOLA `LDEM_75S_240M`) | Cross-check of the new grid south of 80 S | `docs/sources/T04.md` | NASA PDS data, public domain |
| three.js 0.187 (`DataTexture`, object-space normal map on `MeshLambertMaterial`) | Drawing the textures on the globe | https://threejs.org/docs/ | MIT |
| NumPy 2.5.4 | Reading and re-ordering the grid | https://numpy.org | BSD |
