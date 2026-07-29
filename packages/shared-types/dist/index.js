"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyType = exports.ApprovalStatus = void 0;
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["PENDING"] = "PENDING";
    ApprovalStatus["APPROVED"] = "APPROVED";
    ApprovalStatus["REJECTED"] = "REJECTED";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
var DependencyType;
(function (DependencyType) {
    DependencyType["REQUIRED"] = "REQUIRED";
    DependencyType["RECOMMENDED"] = "RECOMMENDED";
})(DependencyType || (exports.DependencyType = DependencyType = {}));
