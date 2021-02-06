import { SCENES_NAME } from "../Common/Constant";
import AudioController from "../Game/AudioController";
import FruitController from "../Game/FruitController";
import NodePool from "../Libraries/NodePool";
import PlatformSystem from "../Platform/PlatformSystem";
import SceneManagerSystem from "../System/SceneManagerSystem";

const { ccclass, property } = cc._decorator;
const moveSpeed: number = 2000;

@ccclass
export default class GameSceneController extends cc.Component {
    public static I: GameSceneController;

    @property(cc.Node)
    public fruitArea: cc.Node = null

    @property(cc.Node)
    public fruitPosition: cc.Node = null

    @property(cc.Node)
    public nodeDangerous: cc.Node = null

    @property(cc.Node)
    public nodeFinger: cc.Node = null

    @property(cc.Node)
    public nodeEndPage: cc.Node = null

    @property(cc.Label)
    public labelScore: cc.Label = null

    @property(cc.Label)
    public labelScoreEnd: cc.Label = null

    @property([cc.Prefab])
    public prefabFruits: cc.Prefab[] = [];

    @property([cc.Prefab])
    public prefabFruitBooms: cc.Prefab[] = [];


    private _currentFruit: FruitController = null;
    private _existFruits: FruitController[] = [];
    private _fruitSelections: number[] = [];

    private _score: number = 0;
    public get score(): number {
        return this._score;
    }
    public set score(v: number) {
        this._score = v;
        this.labelScore.string = v.toString();
    }


    private _maxLevel: number;
    public get maxLevel(): number {
        return this._maxLevel;
    }
    public set maxLevel(v: number) {
        if (v <= this.maxLevel) return;
        this._maxLevel = v;
        switch (v) {
            case 0:
                this._fruitSelections = [0];
                break;
            case 1:
                this._fruitSelections = [1, 2];
                break;
            case 2:
            case 3:
                this._fruitSelections = [1, 2, 3];
                break;
            default:
                this._fruitSelections = [1, 2, 3, 4];
                break;
        }
    }


    public gameover: boolean = false;


    public onLoad() {
        GameSceneController.I = this;
        this.hideEndPage();
        this.score = 0;
        this.maxLevel = 0;
        this.fruitArea.on(cc.Node.EventType.TOUCH_END, this.releaseFruit, this);
    }

    public start() {
        PlatformSystem.platform.showBannerAd();
        this.addFruit();
    }

    public addFruit(): void {
        let fruit = this.getOneFruit();
        this.fruitArea.addChild(fruit);
        let currentFruit = fruit.getComponent(FruitController);
        currentFruit.initForNew();
        if (this.fruitPosition.y - fruit.height / 2 > this.nodeDangerous.y) {
            fruit.setPosition(this.fruitPosition.position);
        } else {
            fruit.setPosition(this.fruitPosition.x, this.nodeDangerous.y + fruit.height / 2 + 20);
        }
        fruit.scale = 0;
        cc.tween(fruit)
            .to(0.25, { scale: 1 })
            .call(() => {
                this._currentFruit = currentFruit;
            })
            .start();
    }

    public releaseFruit(e: cc.Event.EventTouch): void {
        if (this.nodeFinger.active) this.nodeFinger.active = false;
        if (this.gameover) return;
        if (!this._currentFruit) return;
        let currentFruit = this._currentFruit;
        this._currentFruit = null;
        this._existFruits.push(currentFruit);
        let x = this.fruitArea.convertToNodeSpaceAR(e.getLocation()).x;
        cc.tween(currentFruit.node)
            .to(Math.abs(x - currentFruit.node.x) / moveSpeed, { x: x }, { easing: t => 1 - Math.pow(1 - t, 3) })
            .call(() => {
                currentFruit.fall();
                this.scheduleOnce(this.addFruit, 1);
            })
            .start();
    }

    public checkDangerous(f: cc.Node): void {
        if (f.y + f.height / 2 > this.nodeDangerous.y) {
            this.gameover = true;
            let t = cc.tween()
                .to(0.2, { opacity: 50 })
                .to(0.2, { opacity: 255 });
            cc.tween(this.nodeDangerous).then(t)
                .repeatForever()
                .start();
            this.scheduleOnce(() => {
                // TODO 显示结算页面
                this.showEndPage();
            }, 2);
        }
    }

    public clean(): void {

    }

    public startGame(): void {

    }






    public getOneFruit(): cc.Node {
        let index = this._fruitSelections[Math.floor(this._fruitSelections.length * Math.random())];
        let prefab = this.prefabFruits[index];
        let node = NodePool.getItem(prefab.name, prefab);
        return node;
    }

    public showMergeFruit(f: FruitController): void {
        let index = f.fruitIndex + 1;
        if (index >= this.prefabFruits.length) return;
        this.maxLevel = index;
        this.score += Math.pow(2, index);
        let prefab = this.prefabFruits[index];
        let node = NodePool.getItem(prefab.name, prefab);
        let fc = node.getComponent(FruitController);
        this._existFruits.push(fc);
        node.position = f.node.position;
        this.fruitArea.addChild(node);
        fc.initForUpgrade();
        let bf = this.prefabFruitBooms[index];
        if (!bf) return;
        let nodeBoom = NodePool.getItem(bf.name, bf);
        this.fruitArea.addChild(nodeBoom);
        nodeBoom.position = node.position;
    }

    public blastOne(f: FruitController): void {
        let node = f.node;
        let bf = this.prefabFruitBooms[f.fruitIndex];
        if (!bf) return;
        let nodeBoom = NodePool.getItem(bf.name, bf);
        this.fruitArea.addChild(nodeBoom);
        nodeBoom.position = node.position;
        AudioController.I.playMerge();
    }

    public removeFruit(f: FruitController): void {
        this._existFruits.splice(this._existFruits.indexOf(f), 1);
    }

    public revive(): void {
        this.nodeDangerous.active = false;
        this._existFruits.sort((a: FruitController, b: FruitController) => {
            return a.fruitIndex - b.fruitIndex;
        });
        let i = 0;
        while (i < 4) {
            this.scheduleOnce(() => {
                let f = this._existFruits.shift();
                if (!f) return;
                f.blast();
            }, 0.2 * (i + 1));
            i += 1;
        }
        this.gameover = false;
    }

    public showEndPage(): void {
        this.nodeEndPage.active = true;
    }

    public hideEndPage(): void {
        this.nodeEndPage.active = false;
    }
}
