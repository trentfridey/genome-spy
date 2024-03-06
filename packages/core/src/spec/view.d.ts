import { Data } from "./data.js";
import { TransformParams } from "./transform.js";
import {
    Channel,
    Encoding,
    FacetFieldDef,
    PrimaryPositionalChannel,
} from "./channel.js";
import {
    FillAndStrokeProps,
    MarkConfigAndType,
    MarkType,
    RectProps,
} from "./mark.js";
import { ExprRef } from "./parameter.js";
import { Title } from "./title.js";
import { SampleSpec } from "./sampleView.js";
import { Parameter } from "./parameter.js";

export interface SizeDef {
    /** Size in pixels */
    px?: number;

    /** Share of the remaining space */
    grow?: number;
}

// TODO: Perhaps this should be in "utils"
export type GeometricDimension = "width" | "height";

export interface FacetMapping {
    column?: FacetFieldDef;
    row?: FacetFieldDef;
}

/**
 * DynamicOpacity specifies a zoom-dependent behavior for view opacity.
 * The opacity is interpolated between the specified stops.
 */
export interface DynamicOpacity {
    channel?: PrimaryPositionalChannel;
    /** Stops expressed as units (base pairs, for example) per pixel. */
    unitsPerPixel: number[];
    /** Opacity values that match the given stops. */
    values: number[];
}

export type ViewOpacityDef = number | DynamicOpacity | ExprRef;

export interface Step {
    step: number;
}

export type Side = "top" | "right" | "bottom" | "left";

export type Paddings = Partial<Record<Side, number>>;

export type PaddingConfig = Paddings | number;

interface CompleteViewBackground extends RectProps, FillAndStrokeProps {
    // TODO: style?: string | string[];

    // TODO: Move to FillAndStrokeProps or something
    strokeWidth?: number;
}

export type ViewBackground = Pick<
    CompleteViewBackground,
    "fill" | "fillOpacity" | "stroke" | "strokeWidth" | "strokeOpacity"
>;

export interface ViewSpecBase extends ResolveSpec {
    name?: string;

    /**
     * Height of the view. If a number, it is interpreted as pixels.
     *
     * **Default:** `"container"`
     */
    height?: SizeDef | number | Step | "container";

    /**
     * Width of the view. If a number, it is interpreted as pixels.
     *
     * **Default:** `"container"`
     */
    width?: SizeDef | number | Step | "container";

    /**
     * Optional viewport height of the view. If the view size exceeds the viewport height,
     * it will be shown with scrollbars. This property implicitly enables clipping.
     *
     * **Default:** `null` (same as `height`)
     */
    viewportHeight?: SizeDef | number | "container";

    /**
     * Optional viewport width of the view. If the view size exceeds the viewport width,
     * it will be shown with scrollbars. This property implicitly enables clipping.
     *
     * **Default:** `null` (same as `width`)
     */
    viewportWidth?: SizeDef | number | "container";

    /**
     * Padding in pixels.
     *
     * **Default:* `0`
     */
    padding?: PaddingConfig;

    /**
     * Dynamic variables that parameterize a visualization.
     */
    params?: Parameter[];

    data?: Data;
    transform?: TransformParams[];
    encoding?: Encoding;
    title?: string | Title;

    /**
     * A description of the view. Multiple lines can be provided as an array.
     */
    description?: string | string[];

    /**
     * Optional base URL for constructing request URLs. When set, all views
     * deeper in the hierarchy inherit this base URL, using it for importing
     * loading data and importing specifications.
     */
    baseUrl?: string;

    /**
     * Opacity of the view and all its children.
     *
     * **Default:** `1.0`
     */
    // TODO: Should be available only in Unit and Layer views.
    opacity?: ViewOpacityDef;

    /**
     * Visibility of the view. An invisible view is removed from the layout
     * and not rendered.
     *
     * **Default:** `true`
     */
    // TODO: Detach invisible views from the data flow.
    visible?: boolean;

    /**
     * Is the visibility configurable interactively from the App.
     * Configurability requires that the view has an explicitly specified name
     * that is *unique* in within the view specification.
     *
     * **Default:** `false` for children of `layer`, `true` for others.
     */
    configurableVisibility?: boolean;

    /**
     * Templates that can be reused within the view specification by importing
     * them with the template key.
     */
    templates?: Record<string, ViewSpec>;
}

export interface UnitSpec extends ViewSpecBase, AggregateSamplesSpec {
    view?: ViewBackground;
    mark: MarkType | MarkConfigAndType;
}

export interface AggregateSamplesSpec {
    // TODO: Introduce a type (UnitSpec | LayerSpec) that can ba used in SampleView and here
    aggregateSamples?: (UnitSpec | LayerSpec)[];
}

export interface LayerSpec extends ViewSpecBase, AggregateSamplesSpec {
    view?: ViewBackground;
    layer: (LayerSpec | UnitSpec | ImportSpec)[];
}

export interface FacetSpec extends ViewSpecBase {
    facet: any; //FacetMapping | FacetFieldDef
    spec: LayerSpec | UnitSpec;
    columns?: number;
    spacing?: number;
}

export type ResolutionTarget = "scale" | "axis";

/**
 * `"independent"` and `"shared"` behave similarly to Vega-Lite.
 * `"excluded"` behaves like `"shared"`, but is not pulled towards the root.
 * `"forced"` behaves like `"shared"`, but is forced towards the root even
 * if the parent has `"independent"` behavior.
 */
export type ResolutionBehavior =
    | "independent"
    | "shared"
    | "excluded"
    | "forced";

export interface ResolveSpec {
    resolve?: Partial<
        Record<
            ResolutionTarget,
            Partial<Record<Channel | "default", ResolutionBehavior>>
        >
    >;
}

export type ContainerSpec = (
    | LayerSpec
    //    | FacetSpec
    | SampleSpec
    | VConcatSpec
    | HConcatSpec
    | ConcatSpec
    | UnitSpec
) &
    ResolveSpec;

export type ViewSpec =
    | UnitSpec
    | LayerSpec
    //    | FacetSpec
    | VConcatSpec
    | HConcatSpec
    | ConcatSpec
    | SampleSpec;

export interface UrlImport {
    /**
     * Imports a specification from the specified URL.
     */
    url: string;
}

export interface TemplateImport {
    /**
     * Imports a specification from the current view hierarchy, searching
     * first in the current view, then ascending through ancestors.
     */
    template: string;
}

export interface ImportSpec {
    /**
     * The name given to the imported view. This property overrides the name
     * specified in the imported specification.
     */
    name?: string;

    /**
     * Dynamic variables that parameterize a visualization. Parameters defined
     * here override the parameters defined in the imported specification.
     */
    params?: Parameter[] | Record<string, any>;

    /**
     * The method to import a specification.
     */
    import: UrlImport | TemplateImport;
}

export interface ConcatBase extends ViewSpecBase {
    /**
     * The gap between the views, in pixels.
     */
    spacing?: number;
}

export interface VConcatSpec extends ConcatBase {
    /**
     * Specifies views that will be concatenated vertically.
     */
    vconcat: (ViewSpec | ImportSpec)[];
}

export interface HConcatSpec extends ConcatBase {
    /**
     * Specifies views that will be concatenated horizontally.
     */
    hconcat: (ViewSpec | ImportSpec)[];
}

export interface ConcatSpec extends ConcatBase {
    /**
     * Specifies views that will be concatenated into a grid that wraps when
     * the specified number of columns are used.
     */
    concat: (ViewSpec | ImportSpec)[];

    /**
     * The number of columns in the grid.
     */
    columns: number;
}

export type AnyConcatSpec = VConcatSpec | HConcatSpec | ConcatSpec;
