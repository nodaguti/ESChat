/* (encoding = EUC-JP)
 *
 * comic balloons
 *
 * CREDIT:
 *   written by tkuri {at} fat.coara.or.jp
 *
 * history:
 *   2010-6-6 書いた
 *   2010-6-7 公開
 *   2010-6-9 ちょっとだけコードを整理
 *   2010-6-10 ヒゲとして「○」を描画できるように
 */

(function(){ // グローバルな名前空間を汚染しないように...


// 名前空間は tkuri.cv. を使います．
// 名前空間に不都合がある場合，次の var _ns = ...; までを改変してください．
if (!window.tkuri) window.tkuri = {}
if (!window.tkuri.cv) window.tkuri.cv = {};
var _ns = window.tkuri.cv;

with (_ns) { // 以下のコードでは，特に指定のない限り，上記で規定した名前空間が使われます

/**
 * 点，あるいはタテヨコを表すクラス．
 * いろんなところで使えるクラスなので，今後の事を考えれば，他のファイルに追い出したいところ...
 */
_ns.Xy = function(_x, _y)
{
	this.x = _x;
	this.y = _y;
};
with (_ns.Xy)
{
	var _p = prototype;

	/**
	 * another から this へコピー
	 */
	_p.assign$ = function(another)
	{
		this.x = another.x;
		this.y = another.y;
	};

	/**
	 * another との距離
	 */
	_p.distanceTo = function(another)
	{
		var dx = this.x - another.x;
		var dy = this.y - another.y;
		return Math.sqrt(dx * dx + dy * dy);
	};

	/**
	 * このオブジェクトが長方形のサイズを表すものとして、対角線の長さ
	 */
	_p.diagonal = function()
	{
		return Math.sqrt(this.x * this.x + this.y * this.y);
	};

	/**
	 * 符号反転
	 */
	_p.negate = function()
	{
		return new Xy(-this.x, -this.y);
	};

	/**
	 * 継ぎ足し
	 * 次の形式のどちらでもok
	 *  var resultA = p1.add(10, 12);  // 形式1 / 数字を入力
	 *  var resultB = p2.add(p3); // 形式2 / bn2dオブジェクトを入力
	 */
	_p.add = function(a1, a2)
	{
		if (typeof a1 === typeof this) {
			a2 = a1.y;
			a1 = a1.x;
		}

		return new Xy(this.x + a1, this.y + a2);
	};

	/**
	 * 拡大縮小
	 */
	_p.scale = function(sx, sy)
	{
		if (arguments.length == 1) {
			sy = sx;
		}
		return new Xy(this.x * sx, this.y * sy);
	};
}
// Xy ここまで


/**
 * w, h の長方形に外接する楕円のデータ．
 * 焦点は長方形の左右の辺上にあるものとする．
 *
 *   this.ps_[0] => 最初の点の座標
 *   this.ps_[1] => 次の点
 *     :
 *   this.ps_[bnEllipse.RESOLUTION - 1] => 最後の点
 *
 *   this.ds_[0] => 最後の点から最初の点への距離をあらかじめ測っておく
 *   this.ds_[1] => 最初の点から次の点への距離
 *     :
 *   this.ds_[bn.Ellipse.RESOLUTION - 1]
 */
_ns.OuterEllipse = function(w, h)
{
	this.inner_ = new Xy(w, h); // テキストを入れたい箱の大きさ
	this.ps_ = [];
	this.ds_ = [];
	this.L_ = 0;
};

// 楕円データを作る際に，1周をどんだけ細かくするか
// static
_ns.OuterEllipse.RESOLUTION = 180;

// メンバ
with (_ns.OuterEllipse)
{
	var _p = prototype;

	// ps_ や ds_ を作り上げる
	_p.requireData_ = function()
	{
		if (this.ps_.length) {
			return this.ps_;
		}

		var halfbox = this.inner_.scale(1.0, 0.5); // 半分の高さ
		var quadbox = this.inner_.scale(0.5, 0.5); // タテヨコとも半分にしたもの
		var a = (halfbox.diagonal() + halfbox.y) / 2;
		var b = Math.sqrt(a * a - quadbox.x * quadbox.x);
		// ここで a => 楕円の長軸，b => 楕円の短軸 が求まった

		var prev_p = new Xy(a, 0);

		var round = Math.PI * 2;
		var step = round / RESOLUTION;
		for (var deg = 0; deg < round; deg += step) {
			var x =  a * Math.cos(deg);
			var y = -b * Math.sin(deg);

			var p = new Xy(x, y);
			this.ps_.push(p);

			var d = prev_p.distanceTo(p);
			this.ds_.push(d);
			this.L_ += d;

			prev_p = p;
		}

		// 最後に，ゴール地点からスタート地点までの距離を測って ds_[0] に上書き
		var d = prev_p.distanceTo( this.ps_[0] );
		this.ds_[0] = d;
		this.L_ += d;

		return this.ps_;
	};

	// アイテムの個数
	_p.count = function()
	{
		return this.requireData_().length;
	};

	// bn2dオブジェクトを得る
	_p.at = function(p)
	{
		return (this.requireData_())[p];
	};

	// 点pと，その一つ前の点との距離
	_p.delta = function(p)
	{
		this.requireData_();
		return this.ds_[p];
	};

	// 外周の長さ
	_p.L = function()
	{
		this.requireData_();
		return this.L_;
	};
}

/**
 * @param cxt  obj of canvas.getContext('2d')
 * @param ox   left boundary of text box
 * @param oy   top boundary of text box
 * @param w    width of text box
 * @param h    height of text box
 *  -- optional --
 * @param spikes  spikes count. 4 ~ 20 is good.
 * @param depth   spike depth.  -1.0 ~ 1.0 is nice.
 * @param rot     rotation ...   0 ~ 359.
 * @param hige    arrow length.  0.5 is pretty cool.
 */
_ns.drawBalloonPath = function(cxt, ox, oy, w, h, spikes, depth, rot, hige)
{
	if (!spikes) spikes = 1;
	if (!depth) depth = 0;
	if (!rot) rot = 0;
	if (!hige) hige = 0;

	rot %= 360;
	rot /= (360 / OuterEllipse.RESOLUTION);
	rot = Math.floor(rot);

	var cx = ox + w / 2;
	var cy = oy + h / 2;

	var alt_dep = 1 + Math.abs(depth);
	var data = (depth > 0)
			? new OuterEllipse(w, h, rot)
			: new OuterEllipse(w * alt_dep, h * alt_dep, rot);

	var t = 0;
	var t2 = 0;
	var step = data.L() / spikes;
	var count = 0;

	var start = rot;
	var i = start;
	var prev_i = i;
	var last = data.count() + rot;
	while (i <= last) {

		var n = i % data.count();
		var p = data.at(n);
		var d = data.delta(n);

		t += d;
		t2 += d;

		if (i == start) {
			// ふきだしにヒゲや o o o をつける？
			if (typeof hige == 'string') {
				// o o o をつける
				var p1 = p.scale(1.2);
				var rad = h / 10;
				for (var k = 0; k < hige.length; k++) {
					cxt.moveTo(cx + p1.x + rad, cy + p1.y); // subpathをここにやらないとへんな線が...
					cxt.arc(cx + p1.x, cy + p1.y, rad, 0, Math.PI * 2, false);
					rad /= 2;
					p1 = p1.scale(1.2);
				}

				cxt.moveTo(cx + p.x, cy + p.y);

			} else if (hige) {
				// 数値ならヒゲをつける
				var p1 = data.at((start + 2) % data.count());
				var d = p.scale(1 + hige);

				cxt.moveTo(cx + p.x, cy + p.y);
				cxt.quadraticCurveTo(
						cx + d.x, cy + d.y,
						cx + p1.x, cy + p1.y);
				i += 2;

			} else {
				cxt.moveTo(cx + p.x, cy + p.y);
			}

			prev_i = i;

		} else if (depth == 0) {
			// spike の深さが 0 なら，綺麗な楕円を描くだけ
			cxt.lineTo(cx + p.x, cy + p.y);

		} else if ((data.L() - t2) < 10 && i < last) {
			// t2 が data.L() に近い = つまりもうすぐ周を終える．
			// どうせだから i == last になるまで何もしない．

		} else if (t >= step || i == last) {
			// spike の深さがあるなら，
			// ここまで辿った円周の距離 t が step に達する毎に
			// トゲトゲ (あるいはモコモコ) を描く
			var alt_i = Math.floor((i + prev_i) / 2);
				alt_i = alt_i % data.count();
			var alt_p = data.at(alt_i);
			var alt_x = (depth > 0) ? alt_p.x * alt_dep : alt_p.x / alt_dep;
			var alt_y = (depth > 0) ? alt_p.y * alt_dep : alt_p.y / alt_dep;

			cxt.quadraticCurveTo(
				cx + alt_x,
				cy + alt_y,
				cx + p.x,
				cy + p.y);

			t -= step;
			prev_i = i;
		}

		i++;
	}
}

} // 名前空間 tkuri.cv. ここまで

})(); // グローバルな名前空間を汚染しないように...

