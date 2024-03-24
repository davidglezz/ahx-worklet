# Changelog

## 1.0.0 (2024-03-24)


### Features

* add basic node and worklet classes ([a9efc55](https://github.com/davidglezz/ahx-worklet/commit/a9efc556b53f4faeb9698cd4cb8f364def1e213b))
* add favicon ([0b0a905](https://github.com/davidglezz/ahx-worklet/commit/0b0a90512dfb3929fd4557058d9d0058ee253dfc))
* add position bar ([2536d54](https://github.com/davidglezz/ahx-worklet/commit/2536d54a4a7a89e3d6ff1764ee0a4357c9d97bb1))
* add slider label ([9ff08ea](https://github.com/davidglezz/ahx-worklet/commit/9ff08ea1af68d39de3181d24c56128b0d609ee81))
* add songlist ([0ad03e7](https://github.com/davidglezz/ahx-worklet/commit/0ad03e790258f1f0c0d3cd08d9d09256d1142ef3))
* add visualizer ([f454d1e](https://github.com/davidglezz/ahx-worklet/commit/f454d1efd739ae09f77ce225aca3a3434c228563))
* add volume slider ([5183aa9](https://github.com/davidglezz/ahx-worklet/commit/5183aa9d89d3c952c11b4d7baf16bcba44431d44))
* **analyser:** minor improvements ([295fd0d](https://github.com/davidglezz/ahx-worklet/commit/295fd0d1b6f6f645f1944d682939735b32385f5f))
* change noise pregenerated data by generator function ([e3f30c8](https://github.com/davidglezz/ahx-worklet/commit/e3f30c8b5e9cf8871da0536839227f2e7259cf1f))
* change position instantly ([987a0d7](https://github.com/davidglezz/ahx-worklet/commit/987a0d792d102429e6988746ffa35d46ebf93531))
* encode noise using base256 ([266e7ea](https://github.com/davidglezz/ahx-worklet/commit/266e7ea875ebbcd0b6fb17f3e8ff72b7b2b46b6f))
* highlight active song ([86fc42e](https://github.com/davidglezz/ahx-worklet/commit/86fc42e7b2c559cab49021bf7b7cc925c0dc1598))
* improve play/stop button styles ([4ae6368](https://github.com/davidglezz/ahx-worklet/commit/4ae63684785be322f45b2cb4dba4b67e8eabd5a9))
* improve song list ([13bfae1](https://github.com/davidglezz/ahx-worklet/commit/13bfae1d38456cd3110cc5b12b4e151f78d2f8b0))
* improve styles ([cd0da75](https://github.com/davidglezz/ahx-worklet/commit/cd0da751f5ae72d088ff8d748b25a22f739720f1))
* **worklet:** precompute simple operation ([730edf9](https://github.com/davidglezz/ahx-worklet/commit/730edf9f638067efa40ad50002dc3685387a7299))


### Bug Fixes

* fix AudioWorklet url on build ([d2bfb49](https://github.com/davidglezz/ahx-worklet/commit/d2bfb49ecf1351741e32a332dd411f50a6d32cc3))
* fix eslint errors ([6f334f4](https://github.com/davidglezz/ahx-worklet/commit/6f334f44d850406e09deb929c067e93dce1d3edc))
* fix initial load ([0e1cfe9](https://github.com/davidglezz/ahx-worklet/commit/0e1cfe9bed6fefd71ceb0a6798e4d6612668fa0a))
* fix layout in firefox ([6b6e96a](https://github.com/davidglezz/ahx-worklet/commit/6b6e96a8d28668aabb03c8c9bf6bdeb837c02d43))
* fix refactoring logic errors ([19cd44f](https://github.com/davidglezz/ahx-worklet/commit/19cd44f17e04171e4a559beb3faab58f91981b29))
* improve seek ([2417de5](https://github.com/davidglezz/ahx-worklet/commit/2417de5c011fb3c9f19e38b57b17da02ca08a78a))
* layout and ligth theme colors ([95e5052](https://github.com/davidglezz/ahx-worklet/commit/95e505225c07e9725a5f28755d4c9622eb6cf18e))


### Performance Improvements

* avoid clone or flat square and noise buffers ([a5ece50](https://github.com/davidglezz/ahx-worklet/commit/a5ece50c3107bbc7b4ddce9ab80f8742421d40e4))
* compare hash to avoid render with the reference implementation ([1df682e](https://github.com/davidglezz/ahx-worklet/commit/1df682ef8b81cbf7af6b871c9ec228b8b7f528d0))
* improve GenerateSquare ([8f0eaa6](https://github.com/davidglezz/ahx-worklet/commit/8f0eaa630825bb7943d0dd1d48616ccd4633e54e))
* improve song arrays ([d99cb48](https://github.com/davidglezz/ahx-worklet/commit/d99cb48a443d02761268498472039b5a910a6f1c))
* measure waves speed ([5d503df](https://github.com/davidglezz/ahx-worklet/commit/5d503dfdd9ec43019e399e1994ac260c038d01fd))
* optimize filter ([68c1818](https://github.com/davidglezz/ahx-worklet/commit/68c181805ddd1b7b6ac0a8cb36123e9ce94fe09c))
* **player:** improve setAudio performance ([47e406f](https://github.com/davidglezz/ahx-worklet/commit/47e406fdf9bc61d0ec71266988af0136b94e5de0))
* use Int16 for MixingBuffer ([d85bc5c](https://github.com/davidglezz/ahx-worklet/commit/d85bc5c70ad2d2173155f287943370fe3d22613b))
* use Int8Array to store waves ([e155299](https://github.com/davidglezz/ahx-worklet/commit/e1552992d43f0464d496b3219da631777038915d))
* use Uint8 in voice ([17fa44b](https://github.com/davidglezz/ahx-worklet/commit/17fa44bbee1fbed8cb77cd721296f87a87e5cb37))
* **waves:** compute waves once ([39851df](https://github.com/davidglezz/ahx-worklet/commit/39851dfc4446f9c1492dfc27a76fa75c509c0363))
